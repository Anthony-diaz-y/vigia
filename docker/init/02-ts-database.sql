-- Target TypeScript database during the strangler period. The Python service
-- keeps using `vigia` until the backfill and cutover.
CREATE DATABASE vigia_ts;
