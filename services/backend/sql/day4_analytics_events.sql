-- ============================================================
-- Day 4: Analytics Events Table
-- ============================================================
-- Ürün metrikleri için analytics_events tablosu.
-- PostHog'a ek olarak kendi DB'ne de yazılabilir (audit + analytics).
--
-- Kullanım: track() helper'dan veya doğrudan insert ile.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     uuid,
  event_name  text NOT NULL,
  request_id  text,
  entity_type text,
  entity_id   bigint,
  properties  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- En sık sorgular için indeksler
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created
  ON public.analytics_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_created
  ON public.analytics_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_entity
  ON public.analytics_events (entity_type, entity_id);

-- RLS (gerekiyorsa)
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Service role her şeyi yapabilir (backend insert eder)
CREATE POLICY "service_role_all" ON public.analytics_events
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.analytics_events IS 'Product analytics events — backend track() helper tarafından doldurulur';
