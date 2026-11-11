-- Default 청약홈 feeds and categories. Editable/deletable in /admin afterwards.
-- Category order is match priority: 민간임대 comes before 오피스텔 so that
-- 민간임대 notices from the 오피스텔·도시형 feed land in 민간임대.
INSERT INTO "housing_feeds" ("name", "endpoint", "active") VALUES
  ('APT 분양', 'getAPTLttotPblancDetail', true),
  ('APT 무순위·잔여세대', 'getRemndrLttotPblancDetail', true),
  ('오피스텔·도시형', 'getUrbtyOfctlLttotPblancDetail', true),
  ('공공지원 민간임대', 'getPblPvtRentLttotPblancDetail', true),
  ('임의공급', 'getOPTLttotPblancDetail', true)
ON CONFLICT ("endpoint") DO NOTHING;
--> statement-breakpoint
INSERT INTO "housing_categories" ("name", "description", "keywords", "sort_order") VALUES
  ('APT 분양', '아파트 일반·특별공급', '{"APT 분양"}', 0),
  ('무순위·잔여세대', '무순위, 잔여세대, 취소후재공급', '{"무순위","잔여세대"}', 1),
  ('민간임대', '공공지원·일반 민간임대', '{"민간임대"}', 2),
  ('오피스텔·도시형', '오피스텔, 도시형생활주택, 생활숙박시설', '{"오피스텔","도시형"}', 3),
  ('임의공급', '임의공급', '{"임의공급"}', 4)
ON CONFLICT ("name") DO NOTHING;
