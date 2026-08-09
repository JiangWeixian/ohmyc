#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "$0")/.." && pwd)"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

font_pixel="$root_dir/scripts/assets/PressStart2P-Regular.ttf"
font_ui="/System/Library/Fonts/Menlo.ttc"
font_mono="/System/Library/Fonts/SFNSMono.ttf"
out="${OUTPUT_PNG:-$root_dir/docs/images/ohmyc-feature-overview.png}"
web_out="${OUTPUT_WEBP:-$root_dir/docs/images/ohmyc-feature-overview.webp}"

if [[ "${SHADOWS:-1}" == "0" ]]; then
  monitor_ambient=0
  monitor_shadow=0
  timeline_ambient=0
  timeline_shadow=0
  card_ambient=0
  card_shadow=0
else
  monitor_ambient=20
  monitor_shadow=82
  timeline_ambient=24
  timeline_shadow=88
  card_ambient=28
  card_shadow=92
fi

magick "$root_dir/docs/images/monitor.png" \
  -resize 1100x733 -modulate 80,90,100 \
  \( -size 1100x733 xc:none -fill white -draw 'roundrectangle 0,0 1099,732 14,14' \) \
  -alpha off -compose CopyOpacity -composite -compose over \
  -stroke 'rgba(255,255,255,0.12)' -strokewidth 1 -fill none \
  -draw 'roundrectangle 0.5,0.5 1098.5,731.5 14,14' \
  -background none -rotate -2.2 \
  \( +clone -background '#33413c' -shadow "${monitor_ambient}x16+0+12" \) \
  \( +clone -background '#000000' -shadow "${monitor_shadow}x28+18+30" \) \
  -reverse -background none -layers merge +repage \
  "$work_dir/monitor.png"

magick "$root_dir/docs/images/timeline.png" \
  -resize 1200x800 -modulate 94,96,100 \
  \( -size 1200x800 xc:none -fill white -draw 'roundrectangle 0,0 1199,799 14,14' \) \
  -alpha off -compose CopyOpacity -composite -compose over \
  -stroke 'rgba(255,255,255,0.14)' -strokewidth 1 -fill none \
  -draw 'roundrectangle 0.5,0.5 1198.5,798.5 14,14' \
  -background none -rotate -2.2 \
  \( +clone -background '#38423f' -shadow "${timeline_ambient}x18+0+14" \) \
  \( +clone -background '#000000' -shadow "${timeline_shadow}x32+20+34" \) \
  -reverse -background none -layers merge +repage \
  "$work_dir/timeline.png"

magick "$root_dir/docs/images/menubar-chart.png" \
  -resize 238x220 -modulate 82,94,100 \
  \( -size 238x220 xc:none -fill white -draw 'roundrectangle 0,0 237,219 12,12' \) \
  -alpha off -compose CopyOpacity -composite -compose over \
  -stroke 'rgba(255,255,255,0.16)' -strokewidth 1 -fill none \
  -draw 'roundrectangle 0.5,0.5 236.5,218.5 12,12' \
  -background none -rotate -2.5 \
  \( +clone -background '#46514d' -shadow "${card_ambient}x12+0+8" \) \
  \( +clone -background '#000000' -shadow "${card_shadow}x18+14+20" \) \
  -reverse -background none -layers merge +repage \
  "$work_dir/activity-chart.png"

magick "$root_dir/docs/images/menubar-heatmap.png" \
  -resize 238x220 -modulate 78,92,100 \
  \( -size 238x220 xc:none -fill white -draw 'roundrectangle 0,0 237,219 12,12' \) \
  -alpha off -compose CopyOpacity -composite -compose over \
  -stroke 'rgba(255,255,255,0.16)' -strokewidth 1 -fill none \
  -draw 'roundrectangle 0.5,0.5 236.5,218.5 12,12' \
  -background none -rotate 2.5 \
  \( +clone -background '#46514d' -shadow "${card_ambient}x12+0+8" \) \
  \( +clone -background '#000000' -shadow "${card_shadow}x18+14+20" \) \
  -reverse -background none -layers merge +repage \
  "$work_dir/activity-grid.png"

magick -size 1920x1080 xc:'#08090a' \
  \( -size 1300x1080 radial-gradient:'#1a201d-#08090a' -alpha set -channel A -evaluate multiply 0.42 +channel \) \
  -gravity east -composite \
  "$work_dir/monitor.png" -gravity northwest -geometry +850+5 -compose over -composite \
  "$work_dir/timeline.png" -gravity northwest -geometry +705+235 -compose over -composite \
  \( -size 1920x1080 xc:none -fill 'rgba(8,9,10,0.98)' -draw 'rectangle 0,0 600,1080' \
     -fill 'rgba(8,9,10,0.84)' -draw 'rectangle 600,0 715,1080' \
     -fill 'rgba(8,9,10,0.48)' -draw 'rectangle 715,0 800,1080' \) \
  -compose over -composite \
  "$work_dir/activity-chart.png" -gravity northwest -geometry +72+700 -compose over -composite \
  "$work_dir/activity-grid.png" -gravity northwest -geometry +252+715 -compose over -composite \
  -font "$font_mono" -fill '#8a8f98' -pointsize 19 -kerning 2 \
  -gravity northwest -annotate +88+118 'OHMYC  /  PERSONAL CODING MONITOR' \
  -font "$font_pixel" -fill '#f7f8f8' -pointsize 42 -kerning -0.8 \
  -annotate +88+270 'YOUR CODING' \
  -annotate +88+346 'WORK, IN FOCUS.' \
  -font "$font_ui" -fill '#aeb4bc' -pointsize 21 -kerning -0.3 \
  -annotate +90+430 'See activity and momentum across' \
  -annotate +90+468 'agents, projects, and time.' \
  -stroke 'rgba(255,255,255,0.10)' -strokewidth 1 -draw 'line 90,566 585,566' -stroke none \
  -font "$font_mono" -fill '#d0d6e0' -pointsize 17 -kerning 0.8 \
  -annotate +90+626 'LOCAL-FIRST   ·   SIGNAL-FIRST' \
  "$out"

magick "$out" -depth 8 -quality 88 "$web_out"

printf '%s\n%s\n' "$out" "$web_out"
