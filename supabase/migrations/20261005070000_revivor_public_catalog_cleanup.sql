-- Revivor public catalog cleanup.
-- Preserve legacy records for historical orders, but keep them out of the public catalog.

update public.products
set is_active = false,
    is_archived = true,
    updated_at = now()
where slug not in (
  'cseet-chapter-wise',
  'cseet-full-syllabus',
  'cseet-combo',
  'cs-executive-module-1',
  'cs-executive-module-2',
  'cs-executive-full-syllabus',
  'cs-executive-combo',
  'cs-professional-module-1',
  'cs-professional-module-2',
  'cs-professional-full-syllabus',
  'cs-professional-combo'
)
and (is_active = true or is_archived = false);

insert into public.products
(title,slug,description,whats_included,course_label,subject_label,keywords,price,discounted_price,format,is_free,is_featured,is_active,is_demo,is_archived)
values
('Revivor — CSEET Chapter-wise Test Series','cseet-chapter-wise','Chapter-wise CSEET tests with expert checking and focused feedback.','Chapter-wise tests; expert checking; 1-on-1 mentorship; 1 year validity','CSEET','All Papers','Revivor CSEET chapter-wise',1499,999,'TEST SERIES',false,true,true,false,false),
('Revivor — CSEET Full-syllabus Test Series','cseet-full-syllabus','Full-syllabus CSEET practice with exam-style testing and feedback.','Full-syllabus tests; expert checking; 1-on-1 mentorship; 1 year validity','CSEET','All Papers','Revivor CSEET full-syllabus',1999,1499,'TEST SERIES',false,true,true,false,false),
('Revivor — CSEET Complete Combo','cseet-combo','Complete CSEET preparation combining chapter-wise and full-syllabus testing.','Chapter-wise + full-syllabus tests; expert checking; mentorship; 1 year validity','CSEET','All Papers','Revivor CSEET combo',2999,1999,'TEST SERIES',false,true,true,false,false),
('Revivor — CS Executive Module 1 Chapter-wise Series','cs-executive-module-1','Chapter-wise CS Executive Module 1 test series with expert checking.','Module 1 tests; expert checking; mentorship; 1 year validity','CS Executive','Module 1','Revivor CS Executive Module 1 chapter-wise',1999,1499,'TEST SERIES',false,true,true,false,false),
('Revivor — CS Executive Module 2 Chapter-wise Series','cs-executive-module-2','Chapter-wise CS Executive Module 2 test series with expert checking.','Module 2 tests; expert checking; mentorship; 1 year validity','CS Executive','Module 2','Revivor CS Executive Module 2 chapter-wise',1999,1499,'TEST SERIES',false,true,true,false,false),
('Revivor — CS Executive Full-syllabus Test Series','cs-executive-full-syllabus','Full-syllabus CS Executive testing across both modules.','Both modules; full-syllabus tests; expert checking; mentorship; 1 year validity','CS Executive','Both Modules','Revivor CS Executive full-syllabus',3499,2499,'TEST SERIES',false,true,true,false,false),
('Revivor — CS Executive Complete Combo','cs-executive-combo','Complete CS Executive test preparation across both modules.','Both modules; chapter-wise + full-syllabus; expert checking; mentorship; 1 year validity','CS Executive','Both Modules','Revivor CS Executive combo',4999,3299,'TEST SERIES',false,true,true,false,false),
('Revivor — CS Professional Module 1 Chapter-wise Series','cs-professional-module-1','Chapter-wise CS Professional Module 1 test series with expert checking.','Module 1 tests; expert checking; mentorship; 1 year validity','CS Professional','Module 1','Revivor CS Professional Module 1 chapter-wise',2499,1799,'TEST SERIES',false,true,true,false,false),
('Revivor — CS Professional Module 2 Chapter-wise Series','cs-professional-module-2','Chapter-wise CS Professional Module 2 test series with expert checking.','Module 2 tests; expert checking; mentorship; 1 year validity','CS Professional','Module 2','Revivor CS Professional Module 2 chapter-wise',2499,1799,'TEST SERIES',false,true,true,false,false),
('Revivor — CS Professional Full-syllabus Test Series','cs-professional-full-syllabus','Full-syllabus CS Professional testing across all modules.','All modules; full-syllabus tests; expert checking; mentorship; 1 year validity','CS Professional','All Modules','Revivor CS Professional full-syllabus',4299,2999,'TEST SERIES',false,true,true,false,false),
('Revivor — CS Professional Complete Combo','cs-professional-combo','Complete CS Professional test preparation across all modules.','All modules; chapter-wise + full-syllabus; expert checking; mentorship; 1 year validity','CS Professional','All Modules','Revivor CS Professional combo',5999,3999,'TEST SERIES',false,true,true,false,false)
on conflict (slug) do update set
title=excluded.title,
description=excluded.description,
whats_included=excluded.whats_included,
course_label=excluded.course_label,
subject_label=excluded.subject_label,
keywords=excluded.keywords,
price=excluded.price,
discounted_price=excluded.discounted_price,
format=excluded.format,
is_free=excluded.is_free,
is_featured=excluded.is_featured,
is_active=true,
is_demo=false,
is_archived=false,
updated_at=now();
