-- Live component rendering, and a fifth game mode.
--
-- Two changes that both touch `questions_public`, so they land together rather than
-- replacing the same view twice.
--
-- ## Why every mode comparison below reads `mode::text`
--
-- Postgres will not let a value added by `alter type … add value` be *used* in the
-- transaction that added it, and `npm run db:sql` concatenates every migration into
-- a single `begin; … commit;`. Written as `mode in ('name-from-description', …)`
-- the literal is parsed as a quiz_mode constant and the whole bundle dies with
-- "unsafe use of new value". Casting the column compares text to text, so the label
-- does not need to exist at parse time.
--
-- The rule for whoever adds a sixth mode: no migration may reference a label it just
-- added — not in a view, not in a check constraint, not in an update. It waits for
-- the next push.

-- ---------------------------------------------------------------------------
-- The fifth mode
-- ---------------------------------------------------------------------------

-- `after 'which-component'` rather than a plain append, so pg_enum's sort order
-- matches MODES element for element and db:verify can assert it.
alter type quiz_mode add value if not exists 'name-from-description' after 'which-component';
alter type run_mode add value if not exists 'name-from-description' after 'which-component';

-- ---------------------------------------------------------------------------
-- Live rendering
-- ---------------------------------------------------------------------------

-- The question's own visual, when it has one. `image_key` stays: it is the older
-- shape, every existing row uses it, and the application reads both.
alter table public.questions add column if not exists stimulus jsonb;

-- The publish rule predates live rendering, so it still demanded a screenshot and
-- would have refused every live-rendered name-that-component question.
--
-- The mode literal here is deliberately *not* cast to text, unlike the views below:
-- a CHECK constraint must be immutable and `enum_out` is only stable. That is safe
-- because 'name-that-component' already existed before this migration — the rule is
-- that you cannot reference a label you just added, and this one is old.
alter table public.questions drop constraint if exists questions_published_is_complete;

alter table public.questions
  add constraint questions_published_is_complete check (
    status <> 'published'
    or (
      char_length(btrim(prompt)) > 0
      and char_length(btrim(explanation)) >= 20
      and jsonb_typeof(options) = 'array'
      and jsonb_array_length(options) between 2 and 6
      and correct_option_id is not null
      and public.jsonb_options_contain(options, correct_option_id)
      and (mode <> 'name-that-component' or image_key is not null or stimulus is not null)
    )
  );

-- A live render is stored as a recipe — component, modifiers, label — plus the
-- markup they compile to. The recipe names the component and the modifier, which on
-- two of the modes is exactly the answer, so it must not survive into the view.
--
-- Immutable so it can be used freely in a view; it only reads its argument.
create or replace function public.public_render(render jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when render is null or render = 'null'::jsonb then null
    -- `compiled` and `imageKey` are what the player needs; everything else is the
    -- recipe that produced them.
    else render - 'component' - 'modifiers' - 'label'
  end
$$;

create or replace function public.public_options(options jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_agg(
      case
        when option ? 'render'
          then jsonb_set(option, '{render}', public.public_render(option -> 'render'))
        else option
      end
      order by ordinality
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(options) with ordinality as entry(option, ordinality)
$$;

-- ---------------------------------------------------------------------------
-- The two views that hard-code the list of modes where the component is the answer
-- ---------------------------------------------------------------------------

create or replace view public.questions_public
with (security_invoker = on)
as
select
  id,
  version,
  mode,
  difficulty,
  case
    when mode::text in ('name-that-component', 'which-component', 'name-from-description')
      then null
    else component
  end as component,
  prompt,
  public.public_options(options) as options,
  doc_url,
  image_key,
  timer_seconds,
  -- Appended, not inserted: `create or replace view` may add columns at the end but
  -- may not rename or reorder the ones already there.
  public.public_render(stimulus) as stimulus
from public.questions
where status = 'published';

create or replace view public.confusion_matrix
with (security_invoker = on)
as
select
  answers.component as expected_component,
  chosen.component as chosen_component,
  count(*)::integer as occurrences
from public.answers
join public.questions
  on questions.id = answers.question_id
  and questions.version = answers.question_version
cross join lateral (
  select option ->> 'component' as component
  from jsonb_array_elements(questions.options) as option
  where option ->> 'id' = answers.chosen_option_id
) as chosen
where answers.correct = false
  and answers.chosen_option_id is not null
  and answers.mode::text in ('name-that-component', 'which-component', 'name-from-description')
  and chosen.component is not null
group by answers.component, chosen.component;

revoke all on function public.public_render(jsonb) from anon, authenticated;
revoke all on function public.public_options(jsonb) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- save_question_version, extended to carry the stimulus
-- ---------------------------------------------------------------------------
--
-- Redefined rather than altered: the column list is spelled out three times inside
-- it, and a function that writes every column but one is the kind of omission that
-- shows up weeks later as a question that lost its picture on edit.
--
-- `stimulus` joins the judged fields — changing what the player is shown changes
-- what was asked, so it cuts a new version like `options` and `image_key` do.

create or replace function public.save_question_version(payload jsonb)
returns table (
  saved_id uuid,
  saved_version integer,
  created_new_version boolean
)
language plpgsql
as $$
declare
  target_id uuid := nullif(payload ->> 'id', '')::uuid;
  live public.questions%rowtype;
  next_version integer;
  judged_changed boolean;
begin
  if target_id is not null then
    select * into live
    from public.questions
    where id = target_id and status <> 'archived'
    limit 1;
  end if;

  -- A question nobody has ever saved, or one whose every version is archived.
  if target_id is null or live.id is null then
    if target_id is null then
      next_version := 1;
    else
      select coalesce(max(version), 0) + 1 into next_version
      from public.questions
      where id = target_id;
    end if;

    insert into public.questions (
      id, version, mode, difficulty, status, component, prompt, options,
      correct_option_id, explanation, doc_url, image_key, timer_seconds, stimulus
    )
    values (
      coalesce(target_id, gen_random_uuid()),
      next_version,
      (payload ->> 'mode')::quiz_mode,
      (payload ->> 'difficulty')::quiz_difficulty,
      coalesce((payload ->> 'status')::question_status, 'draft'),
      payload ->> 'component',
      coalesce(payload ->> 'prompt', ''),
      coalesce(payload -> 'options', '[]'::jsonb),
      nullif(payload ->> 'correct_option_id', ''),
      coalesce(payload ->> 'explanation', ''),
      nullif(payload ->> 'doc_url', ''),
      nullif(payload ->> 'image_key', ''),
      nullif(payload ->> 'timer_seconds', '')::integer,
      nullif(payload -> 'stimulus', 'null'::jsonb)
    )
    returning id, version into saved_id, saved_version;

    created_new_version := false;
    return next;
    return;
  end if;

  judged_changed :=
    (payload ->> 'mode')::quiz_mode is distinct from live.mode
    or (payload ->> 'difficulty')::quiz_difficulty is distinct from live.difficulty
    or payload ->> 'component' is distinct from live.component
    or coalesce(payload ->> 'prompt', '') is distinct from live.prompt
    or coalesce(payload -> 'options', '[]'::jsonb) is distinct from live.options
    or nullif(payload ->> 'correct_option_id', '') is distinct from live.correct_option_id
    or nullif(payload ->> 'image_key', '') is distinct from live.image_key
    or nullif(payload ->> 'timer_seconds', '')::integer is distinct from live.timer_seconds
    or nullif(payload -> 'stimulus', 'null'::jsonb) is distinct from live.stimulus;

  -- Safe to edit in place: either nobody has answered it yet, or nothing that was
  -- judged has moved.
  if not judged_changed or not public.question_has_answers(live.id, live.version) then
    update public.questions
    set mode = (payload ->> 'mode')::quiz_mode,
        difficulty = (payload ->> 'difficulty')::quiz_difficulty,
        status = coalesce((payload ->> 'status')::question_status, live.status),
        component = payload ->> 'component',
        prompt = coalesce(payload ->> 'prompt', ''),
        options = coalesce(payload -> 'options', '[]'::jsonb),
        correct_option_id = nullif(payload ->> 'correct_option_id', ''),
        explanation = coalesce(payload ->> 'explanation', ''),
        doc_url = nullif(payload ->> 'doc_url', ''),
        image_key = nullif(payload ->> 'image_key', ''),
        timer_seconds = nullif(payload ->> 'timer_seconds', '')::integer,
        stimulus = nullif(payload -> 'stimulus', 'null'::jsonb)
    where id = live.id and version = live.version
    returning id, version into saved_id, saved_version;

    created_new_version := false;
    return next;
    return;
  end if;

  -- Archive first: the partial unique index allows only one live version at a time.
  update public.questions
  set status = 'archived'
  where id = live.id and version = live.version;

  insert into public.questions (
    id, version, mode, difficulty, status, component, prompt, options,
    correct_option_id, explanation, doc_url, image_key, timer_seconds, stimulus
  )
  values (
    live.id,
    live.version + 1,
    (payload ->> 'mode')::quiz_mode,
    (payload ->> 'difficulty')::quiz_difficulty,
    coalesce((payload ->> 'status')::question_status, live.status),
    payload ->> 'component',
    coalesce(payload ->> 'prompt', ''),
    coalesce(payload -> 'options', '[]'::jsonb),
    nullif(payload ->> 'correct_option_id', ''),
    coalesce(payload ->> 'explanation', ''),
    nullif(payload ->> 'doc_url', ''),
    nullif(payload ->> 'image_key', ''),
    nullif(payload ->> 'timer_seconds', '')::integer,
    nullif(payload -> 'stimulus', 'null'::jsonb)
  )
  returning id, version into saved_id, saved_version;

  created_new_version := true;
  return next;
end;
$$;
