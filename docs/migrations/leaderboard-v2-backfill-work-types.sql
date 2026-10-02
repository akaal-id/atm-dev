-- Leaderboard v2 (2026-10-02): guess a work type for existing tasks from their labels / titles.
-- Only fills the new, empty work_type_id column; leaders can correct any task afterwards.
update public.tasks t set work_type_id = m.wt
from (
  select task_id, case
    when lb ~ 'offering deck|strategy deck' or ti ~ '(offering|lite|strategy) deck|company profile|annual report' then 'design-deck'
    when lb ~ 'motion reels|"reels"' or ti ~ '\mreels?\M' then 'video-reel'
    when lb ~ 'carousel' or ti ~ '^carousel' then 'design-carousel'
    when lb ~ 'kv poster|"kv"' or ti ~ 'flyer|poster' then 'design-kv'
    when lb ~ 'welcome exhibitor|welcome partner|welcome d8|hei talk' then 'design-feed'
    when lb ~ 'portfolio' then 'design-web'
    when lb ~ 'website|revision & creation' or ti ~ 'website|platform|\[website' then 'web-dev'
    when lb ~ 'sosmed report' or ti ~ '^report' then 'account-report'
    when ti ~ '^\s*blast' then 'account-posting'
    when ti ~ '^\s*(content|exhibit|exhibtior)' then 'design-feed'
  end wt
  from (select task_id, lower(coalesce(labels::text, '')) lb, lower(title) ti from public.tasks where work_type_id = '') src
) m
where t.task_id = m.task_id and m.wt is not null;
