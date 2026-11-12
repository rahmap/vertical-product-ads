# Referensi teknis

[Beranda](../README.id.md) · [English](technical.md) · [Panduan penggunaan](guide.id.md)

[Kebutuhan sistem](#kebutuhan-sistem) · [Pengecekan kualitas](#pengecekan-kualitas) · [Batasan](#batasan) · [Kecepatan terukur](#kecepatan-terukur) · [Struktur repo](#struktur-repo)

## Kebutuhan sistem

| Dependensi | Kegunaan | Dipasang oleh |
|---|---|---|
| Node.js 20+ | Tool engine, render, dan validasi | Anda |
| FFmpeg / FFprobe | Encode, motion blur, loudness, dan frame footage | Anda |
| Python 3.9+ | Analisis ketukan, sintesis suara, dan mixing | Anda |
| Playwright + Chromium, numpy | Render browser dan pengolahan audio | `check_setup.sh` |
| edge-tts, opsional | Voice-over gratis; perlu internet | `check_setup.sh --with edge` |
| faster-whisper, opsional | Transkripsi footage offline | `check_setup.sh --with whisper` |
| API key ElevenLabs, opsional | Voice, musik, dan transkripsi ElevenLabs | Anda, melalui `set_key.sh` |

[Petunjuk instalasi](guide.id.md#instalasi) · [Setup key yang aman](guide.id.md#api-key-elevenlabs)

## Pengecekan kualitas

Pengecekan yang gagal menghentikan build. Agen wajib memperbaiki adegan, bukan melewati gate.

| Pengecekan | Yang dijaga |
|---|---|
| Safe zone | Teks, caption, chip, label, callout, baris centang, teks berisi gambar, dan CTA berada di area aman. Area standar 1080×1920 adalah x 84–930, y 250–1460. |
| Layout | Tidak ada teks/UI bertumpuk atau band dan panel kosong. |
| Dialog | Tidak memotong kata di tengah; segmen suara tidak saling tumpang. |
| Kontrak adegan | Schema, aset, gaya, durasi, dan referensi antarelemen valid. |
| Kontras | Teks chip, label, CTA, callout, baris centang, dan teks berjalan memenuhi ambang validator 3:1 setelah look dan tema proyek digabung. |
| Audio | File akhir berada di −14 LUFS ±0,6, dengan peak paling tinggi −0,5 dBFS. |
| Render | Tidak ada patahan yang tidak semestinya pada sambungan potongan render. |

Preview menyediakan contact sheet dengan cap waktu dan draf setengah ukuran bersuara. Agen meninjau
keduanya beserta snapshot transisi sebelum render final. Pipeline final membuat storyboard.
Pengecekan otomatis tidak membuktikan kebenaran klaim produk dan tidak menggantikan tinjauan video/audio.

Render final bawaan memakai 30 fps, empat subframe per frame, dan shutter 180°. Mastering audio
menyalin video yang sudah dirender, bukan meng-encode ulang. Waktu kata dan ketukan musik yang diukur
mengatur kemunculan teks serta cue suara; musik mengecil saat ada suara bicara.

[Detail render dan QA](../skills/vertical-product-ads/references/render-and-qa.md) ·
[Safe zone](../skills/vertical-product-ads/references/vertical-safe-zones.md) ·
[Sinkron suara dan ketukan](../skills/vertical-product-ads/references/vo-beat-sync.md)

## Batasan

- Skill tidak membuat foto produk, avatar, atau presenter AI. Siapkan gambar dan rekaman kreator
  beserta izin yang diperlukan.
- B-roll tanpa suara bicara dibisukan. Gunakan dialog kreator atau voice-over sebagai jalur suara.
- Tinjauan transkrip dan snapshot tidak menggantikan menonton video. Transkripsi bisa salah pada
  nama merek; periksa caption, termasuk koreksi lewat `captions.fix`.
- Pengukuran audio tidak menggantikan mendengarkan. Dengarkan file akhir sebelum tayang.
- Klaim memerlukan sumber dan footnote di layar. Periksa aturan iklan kategori produk, termasuk
  aturan BPOM untuk kosmetik di Indonesia.
- Teks berisi gambar memerlukan latar tenang; footage di dalam huruf di atas footage ramai bisa sulit dibaca.
- Tema proyek lengkap bisa menimpa look baru dan gagal pengecekan kontras. Saat berganti look,
  pertahankan hanya penyesuaian brand yang diperlukan.

Durasi iklan produksi 15–60 detik, bawaan 30 detik. Di atas 34 detik, konsep yang disetujui wajib
menjelaskan alasannya. Contoh minimal 8,5 detik adalah uji pipeline, bukan iklan produksi.
[Kebijakan durasi](../skills/ad-concept/references/duration-and-platforms.md).

## Kecepatan terukur

Ini contoh pengukuran yang sudah dicatat pada Apple M3 Pro, bukan jaminan waktu render. Isi film,
grain, footage, beban komputer, dan layanan eksternal memengaruhi hasil. Penataan dokumentasi ini
tidak menyertakan benchmark baru.

### Perbandingan renderer awal

Film motion 31 detik yang sama, 1080×1920. “Sebelum” memakai HTML tulisan tangan dan renderer 60 fps.

| Tahap | Sebelum | Skill ini |
|---|---|---|
| Render gambar | 219 dtk, 7.440 subframe | 71 dtk, 3.720 subframe pada 30 fps / 180° |
| Master audio | 35 dtk, encode ulang video | Sekitar 5 dtk, hanya audio |
| Draf bersuara | Tidak tersedia | 12 dtk |
| Penulisan | Sekitar 600 baris JavaScript per iklan | Satu `scenes.json` per iklan |

### Look

[Look sampler 17 detik](../skills/vertical-product-ads/examples/look-sampler/) yang sama,
30 fps dengan motion blur:

| Look | Render gambar |
|---|---|
| `classic` | 39,8 dtk |
| `luxe-editorial` | 39,2 dtk |
| `clean-clinical` | 19,4 dtk |
| `bold-streetwear` | 39,6 dtk |
| `warm-organic` | 40,4 dtk |
| `tech-neon` | 36,4 dtk |
| `pop-playful` | 19,5 dtk |
| `ugc-native` | 16,2 dtk |

Look tanpa grain lebih cepat pada pengukuran ini. Font ikut terpasang bersama skill, jadi memilih
look tidak menambah langkah mengunduh font.

### Layout

[Layout sampler 20 detik](../skills/vertical-product-ads/examples/layout-sampler/), dibandingkan
per detik film dengan look sampler yang diukur terpisah:

| Look | Layout sampler | Per detik film | Acuan look sampler per detik film |
|---|---|---|---|
| `classic` | 45,4 dtk | 2,27 dtk | 2,31 dtk |
| `luxe-editorial` | 43,9 dtk | 2,20 dtk | 2,31 dtk |
| `clean-clinical` | 23,7 dtk | 1,19 dtk | 1,14 dtk |
| `bold-streetwear` | 43,4 dtk | 2,17 dtk | 2,33 dtk |
| `warm-organic` | 45,5 dtk | 2,28 dtk | 2,38 dtk |
| `tech-neon` | 40,6 dtk | 2,03 dtk | 2,14 dtk |
| `pop-playful` | 24,9 dtk | 1,25 dtk | 1,15 dtk |
| `ugc-native` | 19,8 dtk | 0,99 dtk | 0,95 dtk |

Filmnya berbeda, sehingga selisihnya tidak mengisolasi biaya layout. Perbandingan terkontrol yang
menambahkan tiga aliran footage sepanjang film 20 detik mencatat kenaikan 1,8%.

### Uji agen dari awal

Agen baru, dipasang melalui `npx skills add`, tanpa bantuan:

| Mode | Hasil | Prompt sampai MP4 |
|---|---|---|
| Checkpoint | Motion 30 detik, audio gratis | 10 menit 52 detik; konsep pada 1 menit 13 detik |
| Autopilot | Hybrid 24 detik, footage + musik ElevenLabs | 13 menit 28 detik |

Detail pengukuran: [referensi render dan QA](../skills/vertical-product-ads/references/render-and-qa.md)
dan [CHANGELOG](../CHANGELOG.md).

## Struktur repo

| Path | Isi |
|---|---|
| `skills/ad-concept/` | Skill konsep, referensi intake dan kreatif, template brief/konsep/shot list, contoh prompt |
| `skills/vertical-product-ads/` | Skill produksi beserta engine, skrip, schema, look, dan contoh proyek |
| `skills/vertical-product-ads/references/` | Arahan, gaya, look, layout, format adegan, timing, dan QA |
| `skills/vertical-product-ads/looks/` | Preset look dan font OFL bawaan |
| `skills/vertical-product-ads/engine/` | Renderer HTML/JavaScript dengan `seek(t)` deterministik |
| `skills/vertical-product-ads/scripts/` | Orkestrasi preview/final, audio, render, dan validasi |
| `skills/vertical-product-ads/schemas/` | `scenes.schema.json` |
| `docs/` | Panduan penggunaan, galeri, dan referensi teknis dalam bahasa Inggris dan Indonesia |
| `media/` | MP4 dan GIF contoh hasil; tidak ikut terpasang bersama skill |

Contoh proyek: [minimal](../skills/vertical-product-ads/examples/minimal/),
[b-roll produk](../skills/vertical-product-ads/examples/product-broll/),
[look sampler](../skills/vertical-product-ads/examples/look-sampler/),
[layout sampler](../skills/vertical-product-ads/examples/layout-sampler/).
Contoh b-roll memerlukan footage milik Anda sendiri.

Panduan agen: [ad-concept](../skills/ad-concept/SKILL.md) dan
[vertical-product-ads](../skills/vertical-product-ads/SKILL.md).
Kontrak adegan: [referensi format](../skills/vertical-product-ads/references/scenes-format.md).
Panduan kontributor: [AGENTS.md](../AGENTS.md).
