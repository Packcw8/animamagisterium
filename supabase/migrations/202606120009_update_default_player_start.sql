update public.map_routes
set
  path_points = '[{"x":33.8,"y":73.81},{"x":28,"y":62},{"x":42,"y":54},{"x":56,"y":41},{"x":68,"y":38}]'::jsonb,
  updated_at = now()
where id = '11111111-1111-4111-8111-111111111111';
