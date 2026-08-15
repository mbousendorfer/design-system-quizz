-- Saving a batch of questions, all or nothing.
--
-- The bulk import has to be atomic: a spreadsheet of thirty questions where the
-- twenty-ninth is malformed must leave the database exactly as it was, not
-- twenty-eight questions in and one to hunt down.
--
-- Calling `save_question_version` thirty times from the application would be
-- thirty separate transactions. A plpgsql function is one, so any exception
-- anywhere in the loop rolls the whole thing back.

-- `or replace` because these migrations are pasted into the SQL editor by hand:
-- re-running a block that is already applied should be a no-op, not an error that
-- stops the statements after it from running.
create or replace function public.save_question_versions(payloads jsonb)
returns table (
  saved_id uuid,
  saved_version integer,
  created_new_version boolean
)
language plpgsql
as $$
declare
  item jsonb;
begin
  if jsonb_typeof(payloads) <> 'array' then
    raise exception 'save_question_versions expects a JSON array of questions'
      using errcode = 'invalid_parameter_value';
  end if;

  for item in select * from jsonb_array_elements(payloads)
  loop
    return query select * from public.save_question_version(item);
  end loop;
end;
$$;

revoke all on function public.save_question_versions(jsonb) from anon, authenticated;
