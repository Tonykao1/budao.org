CREATE TABLE IF NOT EXISTS pasture_sheep_daily_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES pasture_users(id) ON DELETE CASCADE,
  date_key text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('landscape','portrait')),
  x numeric NOT NULL,
  y numeric NOT NULL,
  flip boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pasture_sheep_daily_positions_user_date_mode_uq
  ON pasture_sheep_daily_positions(user_id, date_key, mode);

CREATE INDEX IF NOT EXISTS pasture_sheep_daily_positions_user_date_idx
  ON pasture_sheep_daily_positions(user_id, date_key);
