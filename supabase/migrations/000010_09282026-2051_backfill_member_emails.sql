update public.workspace_members as wm
set email = lower(btrim(au.email))
from auth.users as au
where wm.user_id = au.id
  and nullif(btrim(wm.email), '') is null
  and au.email is not null
  and char_length(btrim(au.email)) between 3 and 320;
