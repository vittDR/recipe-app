-- Cuisine tags for the original recipe library (docs/recipe-library-plan.md).
insert into public.tag_catalog (name, kind, name_en, name_fr, aliases)
select v.name, 'tag', v.name_en, v.name_fr, v.aliases
from (values
  ('persian', 'Persian', 'Persan', array['persan', 'persane', 'iranian', 'iranien', 'iranienne', 'iran']::text[]),
  ('polish', 'Polish', 'Polonais', array['polonais', 'polonaise', 'pologne']::text[]),
  ('cuban', 'Cuban', 'Cubain', array['cubain', 'cubaine', 'cuba']::text[]),
  ('argentinian', 'Argentinian', 'Argentin', array['argentin', 'argentine', 'argentina', 'argentinean']::text[]),
  ('danish', 'Danish', 'Danois', array['danois', 'danoise', 'danemark']::text[]),
  ('russian', 'Russian', 'Russe', array['russe', 'russie', 'ukrainian', 'ukrainien', 'ukrainienne']::text[]),
  ('creole', 'Creole', 'Créole', array['créole', 'cajun', 'louisiana', 'louisiane']::text[]),
  ('senegalese', 'Senegalese', 'Sénégalais', array['sénégalais', 'sénégalaise', 'sénégal', 'west african', 'afrique de l''ouest']::text[])
) as v(name, name_en, name_fr, aliases)
where not exists (select 1 from public.tag_catalog t where t.household_id is null and t.name = v.name);
