-- Allocating an animal decides her containment there and then.
--
-- Containment only ever advanced on an incoming GPS fix. That is right for a
-- moving animal and wrong for a moving allocation: an officer who assigns an
-- animal to a paddock has changed what "outside" means, and the platform
-- already holds the position needed to answer the question. Until the tag
-- reported again — which for these tags can be hours — the animal had no
-- verdict at all.
--
-- Found the hard way. An animal registered during a demonstration was allocated
-- to a homestead she was 717 m away from, and sat on the live map painted the
-- healthy green while the animal beside her, on the same allocation and 700 m
-- out, was red. Nothing was broken; the question had simply never been asked.
--
-- A trigger rather than a call in the two API paths that set an allocation,
-- because an allocation also arrives by import, by a correction in psql, and by
-- whatever writes it next year. The rule belongs beside the data.

create or replace function evaluate_containment_on_allocation()
returns trigger language plpgsql as $$
declare
  v_pos  geography;
  v_at   timestamptz;
begin
  select d.last_position, d.last_fix_at into v_pos, v_at
    from devices d
   where d.animal_id = new.id and d.last_position is not null
   order by d.last_fix_at desc nulls last
   limit 1;

  -- A position from days ago is not evidence of where she is now, and opening
  -- a breach against it would date the event to a moment nobody was watching.
  -- Her next fix will decide, as it always did.
  if v_pos is null or v_at is null or v_at < now() - interval '24 hours' then
    return new;
  end if;

  perform evaluate_containment(new.id, v_pos, v_at);
  return new;
end $$;

drop trigger if exists animals_allocation_containment on animals;

create trigger animals_allocation_containment
  after insert or update of home_parcel_id on animals
  for each row when (new.home_parcel_id is not null)
  execute function evaluate_containment_on_allocation();

-- The animals already carrying an allocation nobody has judged them against.
-- Same 24-hour rule as the trigger: a stale position stays unjudged.
do $$
declare r record;
begin
  for r in
    select a.id, d.last_position as pos, d.last_fix_at as at
      from animals a
      join devices d on d.animal_id = a.id
     where a.home_parcel_id is not null
       and d.last_position is not null
       and d.last_fix_at >= now() - interval '24 hours'
       and not exists (select 1 from containment_status cs where cs.animal_id = a.id)
  loop
    perform evaluate_containment(r.id, r.pos, r.at);
  end loop;
end $$;
