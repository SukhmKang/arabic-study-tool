#!/bin/bash

# Arabic letter audio downloader
# Downloads letter names (/isolated-letters/) and pronunciations (root /audio/)
# from arabicreadingcourse.com

BASE="https://www.arabicreadingcourse.com/audio"

LETTERS=(
  alif ba ta tha jiim hha kha
  daal thaal ra zay siin shiin
  saad daad taa thaa ayn ghayn
  fa qaf kaf lam miim nuun ha waw ya
)

mkdir -p audio/names audio/pronunciation

for letter in "${LETTERS[@]}"; do
  echo "Downloading: $letter"
  curl -s -o "audio/names/$letter.mp3"         "$BASE/isolated-letters/$letter.mp3"
  curl -s -o "audio/pronunciation/$letter.mp3" "$BASE/$letter.mp3"
done

echo "Done. Files saved to audio/names/ and audio/pronunciation/"