-- Question versioning.
--
-- The rule, in one sentence: once a question has been answered, anything that
-- changes what was judged creates a new version, and anything that does not stays
-- editable in place.
--
--   judged      mode, difficulty, component, prompt, options, correct answer,
--               screenshot, timer  -> new version, old one archived
--   not judged  explanation, documentation link, status  -> edited in place
--
-- Fixing a typo in an explanation should not cost you ten plays' worth of
-- statistics, and it does not change what any past player was asked.

create function public.question_has_answers(target_id uuid, target_version integer)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.answers
    where question_id = target_id
      and question_version = target_version
  )
$$;

create function public.questions_guard_versioning()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();

  if not public.question_has_answers(old.id, old.version) then
    return new;
  end if;

  if new.mode is distinct from old.mode
     or new.difficulty is distinct from old.difficulty
     or new.component is distinct from old.component
     or new.prompt is distinct from old.prompt
     or new.options is distinct from old.options
     or new.correct_option_id is distinct from old.correct_option_id
     or new.image_key is distinct from old.image_key
     or new.timer_seconds is distinct from old.timer_seconds
  then
    raise exception
      'question % v% has already been answered: insert a new version instead of editing what was judged',
      old.id, old.version
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

create trigger questions_guard_versioning
  before update on public.questions
  for each row
  execute function public.questions_guard_versioning();

-- ---------------------------------------------------------------------------

-- Saving a question, atomically, with the rule above applied.
--
-- Returns the id and version that were written, and whether a new version had to
-- be cut, so the admin can tell the author what just happened.
create function public.save_question_version(payload jsonb)
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
      correct_option_id, explanation, doc_url, image_key, timer_seconds
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
      nullif(payload ->> 'timer_seconds', '')::integer
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
    or nullif(payload ->> 'timer_seconds', '')::integer is distinct from live.timer_seconds;

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
        timer_seconds = nullif(payload ->> 'timer_seconds', '')::integer
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
    correct_option_id, explanation, doc_url, image_key, timer_seconds
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
    nullif(payload ->> 'timer_seconds', '')::integer
  )
  returning id, version into saved_id, saved_version;

  created_new_version := true;
  return next;
end;
$$;
