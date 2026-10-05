-- Revivor runtime settings and live test-series catalog.
-- Keeps the public site and admin console on the same persistent source of truth.

create table if not exists public.site_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;
grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;

drop policy if exists "public read settings" on public.site_settings;
create policy "public read settings" on public.site_settings
for select to anon, authenticated using (true);

drop policy if exists "admin manage settings" on public.site_settings;
create policy "admin manage settings" on public.site_settings
for all to authenticated
using (public.has_role(auth.uid(),'admin'))
with check (public.has_role(auth.uid(),'admin'));

insert into public.site_settings(key,value) values
('brandName','Revivor CS Test Series'),
('tagline','Let''s crack CS Exams in the upcoming attempt!'),
('whatsappNumber','8887621896')
on conflict (key) do update set value=excluded.value, updated_at=now();

insert into public.products
(title,slug,description,whats_included,course_label,subject_label,keywords,price,discounted_price,format,is_free,is_featured,is_active,is_demo)
values
('Revivor — CSEET Chapter-wise Test Series','cseet-chapter-wise','Chapter-wise CSEET tests with expert checking and focused feedback.','Chapter-wise tests; expert checking; 1-on-1 mentorship; 1 year validity','CSEET','All Papers','Revivor CSEET chapter-wise',1499,999,'TEST SERIES',false,true,true,false),
('Revivor — CSEET Full-syllabus Test Series','cseet-full-syllabus','Full-syllabus CSEET practice with exam-style testing and feedback.','Full-syllabus tests; expert checking; 1-on-1 mentorship; 1 year validity','CSEET','All Papers','Revivor CSEET full-syllabus',1999,1499,'TEST SERIES',false,true,true,false),
('Revivor — CSEET Complete Combo','cseet-combo','Complete CSEET preparation combining chapter-wise and full-syllabus testing.','Chapter-wise + full-syllabus tests; expert checking; mentorship; 1 year validity','CSEET','All Papers','Revivor CSEET combo',2999,1999,'TEST SERIES',false,true,true,false),
('Revivor — CS Executive Module 1 Chapter-wise Series','cs-executive-module-1','Chapter-wise CS Executive Module 1 test series with expert checking.','Module 1 tests; expert checking; mentorship; 1 year validity','CS Executive','Module 1','Revivor CS Executive Module 1 chapter-wise',1999,1499,'TEST SERIES',false,true,true,false),
('Revivor — CS Executive Module 2 Chapter-wise Series','cs-executive-module-2','Chapter-wise CS Executive Module 2 test series with expert checking.','Module 2 tests; expert checking; mentorship; 1 year validity','CS Executive','Module 2','Revivor CS Executive Module 2 chapter-wise',1999,1499,'TEST SERIES',false,true,true,false),
('Revivor — CS Executive Full-syllabus Test Series','cs-executive-full-syllabus','Full-syllabus CS Executive testing across both modules.','Both modules; full-syllabus tests; expert checking; mentorship; 1 year validity','CS Executive','Both Modules','Revivor CS Executive full-syllabus',3499,2499,'TEST SERIES',false,true,true,false),
('Revivor — CS Executive Complete Combo','cs-executive-combo','Complete CS Executive test preparation across both modules.','Both modules; chapter-wise + full-syllabus; expert checking; mentorship; 1 year validity','CS Executive','Both Modules','Revivor CS Executive combo',4999,3299,'TEST SERIES',false,true,true,false),
('Revivor — CS Professional Module 1 Chapter-wise Series','cs-professional-module-1','Chapter-wise CS Professional Module 1 test series with expert checking.','Module 1 tests; expert checking; mentorship; 1 year validity','CS Professional','Module 1','Revivor CS Professional Module 1 chapter-wise',2499,1799,'TEST SERIES',false,true,true,false),
('Revivor — CS Professional Module 2 Chapter-wise Series','cs-professional-module-2','Chapter-wise CS Professional Module 2 test series with expert checking.','Module 2 tests; expert checking; mentorship; 1 year validity','CS Professional','Module 2','Revivor CS Professional Module 2 chapter-wise',2499,1799,'TEST SERIES',false,true,true,false),
('Revivor — CS Professional Full-syllabus Test Series','cs-professional-full-syllabus','Full-syllabus CS Professional testing across all modules.','All modules; full-syllabus tests; expert checking; mentorship; 1 year validity','CS Professional','All Modules','Revivor CS Professional full-syllabus',4299,2999,'TEST SERIES',false,true,true,false),
('Revivor — CS Professional Complete Combo','cs-professional-combo','Complete CS Professional test preparation across all modules.','All modules; chapter-wise + full-syllabus; expert checking; mentorship; 1 year validity','CS Professional','All Modules','Revivor CS Professional combo',5999,3999,'TEST SERIES',false,true,true,false)
on conflict (slug) do update set
title=excluded.title,description=excluded.description,whats_included=excluded.whats_included,course_label=excluded.course_label,subject_label=excluded.subject_label,keywords=excluded.keywords,price=excluded.price,discounted_price=excluded.discounted_price,format=excluded.format,is_free=excluded.is_free,is_featured=excluded.is_featured,is_active=true,is_archived=false,is_demo=false,updated_at=now();
