with session_counts as (
  select
    character_id,
    attribute_key,
    count(*)::integer as session_count
  from public.training_sessions
  group by character_id, attribute_key
)
update public.attribute_progress progress
set
  current_xp = session_counts.session_count,
  current_level = floor((sqrt((8 * session_counts.session_count) + 1) - 1) / 2)::integer,
  updated_at = now()
from session_counts
where progress.character_id = session_counts.character_id
  and progress.attribute_key = session_counts.attribute_key;
