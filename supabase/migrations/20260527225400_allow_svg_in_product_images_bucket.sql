/*
  # Add SVG to product-images bucket allowed MIME types

  The bucket currently allows jpeg, png, webp, gif but the logo upload UI
  mentions SVG as a recommended format. This adds image/svg+xml support.
*/

UPDATE storage.buckets
SET allowed_mime_types = array_append(allowed_mime_types, 'image/svg+xml')
WHERE name = 'product-images'
  AND NOT ('image/svg+xml' = ANY(allowed_mime_types));
