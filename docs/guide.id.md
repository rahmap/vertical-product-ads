# Panduan penggunaan

[Beranda](../README.id.md) · [English](guide.md) · [Galeri](showcase.id.md) · [Referensi teknis](technical.id.md)

[Instalasi](#instalasi) · [Menyiapkan bahan](#menyiapkan-bahan) · [Alur kerja](#alur-kerja) · [Suara dan musik](#suara-dan-musik) · [Render](#render)

## Instalasi

Pasang Node.js 20+, Python 3.9+, dan FFmpeg/FFprobe terlebih dahulu. Di macOS, FFmpeg tersedia
melalui `brew install ffmpeg`; di Debian/Ubuntu, `apt install ffmpeg`.
[Kebutuhan lengkap](technical.id.md#kebutuhan-sistem).

Pasang kedua skill:

```bash
npx skills add tomimandalaputra/vertical-product-ads --skill '*' -y
```

Untuk memilih skill dan agen secara interaktif, hapus `--skill '*' -y`. Untuk memasang skill
konsep saja, gunakan `--skill ad-concept`.

Installer mencetak lokasi skill. Claude Code biasanya memakai `.claude/skills/`; Codex dan banyak
agen lain memakai `.agents/skills/`. Isi `SKILL` dengan lokasi skill produksi yang sebenarnya:

```bash
SKILL=".claude/skills/vertical-product-ads"
"$SKILL/scripts/check_setup.sh" --with all
```

Setup memeriksa dependensi dan memasang Chromium, numpy, serta tambahan yang dipilih bila belum ada:

| Perintah | Isinya |
|---|---|
| `check_setup.sh` | Dependensi inti render dan audio |
| `check_setup.sh --with edge` | Inti + voice-over edge-tts |
| `check_setup.sh --with whisper` | Inti + transkripsi lokal faster-whisper |
| `check_setup.sh --with all` | Semua pilihan di atas |

## Menyiapkan bahan

Simpan tiap iklan di folder sendiri, di luar folder skill yang terpasang:

```text
ads/my-product/
  brief.md
  assets/
```

Salin [template brief](../skills/ad-concept/templates/brief.md), atau tuliskan informasi yang sama
di prompt: nama dan varian produk, harga bila diperlukan, klaim beserta sumbernya, CTA persis,
target, platform, dan lokasi aset. Agen bisa menyusun `brief.md` dari prompt tersebut.

| Gaya | Bahan yang disiapkan |
|---|---|
| `motion` | Foto produk. Untuk iklan berbasis foto, usahakan minimal tiga sudut, latar putih atau transparan, dan sisi terpendek minimal 2000 px. |
| `ugc` | Footage kreator dengan suara bicara: vertikal 1080×1920, 30 fps, audio bersih tanpa musik. Tambahkan b-roll singkat dan packshot end card bila tersedia. |
| `hybrid` | Footage dengan foto produk atau adegan grafis. Bisa memakai suara kreator, atau b-roll produk yang dibisukan dan diberi voice-over. |

Logo, warna brand, close-up tekstur, dan satu foto per varian akan membantu. Pastikan izin untuk
orang dan aset pihak ketiga. Before/after, rating, dan testimoni harus asli.
Skill ini tidak membuat foto produk atau presenter AI.

Untuk pengambilan gambar, gunakan [shot list kreator](../skills/ad-concept/templates/creator-shot-list.md).
Spesifikasi aset: [referensi intake](../skills/ad-concept/references/intake.md).
Contoh brief produk fiktif: [motion](../skills/ad-concept/examples/brief-motion.md),
[UGC](../skills/ad-concept/examples/brief-ugc.md), [hybrid](../skills/ad-concept/examples/brief-hybrid.md).

## Alur kerja

1. Minta agen membuat iklan dari folder proyek Anda.
2. `ad-concept` meriset produk, mengusulkan tiga hook, lalu menulis naskah dan rencana adegan.
3. Setujui atau revisi `concept.md`.
4. `vertical-product-ads` menyiapkan audio, animasi, draf, dan contact sheet.
5. Tinjau draf. Agen memperbaiki masalah, lalu merender MP4 final beserta storyboard.

| Mode | Perilakunya |
|---|---|
| Checkpoint, bawaan | Menunggu persetujuan konsep sebelum produksi. |
| Autopilot | Memilih hook dan melanjutkan tanpa menunggu. Asumsi dan keputusan dicatat di `concept.md`. Awali prompt dengan “Autopilot” atau isi `mode: autopilot` di brief. |

Kedua mode tetap memerlukan `concept.md` berstatus disetujui. Autopilot tidak membuat footage
kreator yang belum tersedia dan tidak memberikan izin penggunaan aset.

Contoh permintaan:

> Buatkan iklan TikTok 30 detik dari `ads/my-product`, memakai `brief.md` dan `assets/`.
> Pakai gaya hybrid, look warm-organic, dan split screen untuk perbandingan produk.
> Gunakan hanya klaim dan sumber di brief. Tampilkan konsep sebelum produksi.

Setelah konsep muncul, Anda bisa mengatakan “Pakai hook #2, tetapi jangan tampilkan harga.”
Setelah pratinjau, minta revisi spesifik, misalnya “Klaim di detik 18 terlalu kecil; perbesar lalu
render ulang.” [Kumpulan prompt lengkap](../skills/ad-concept/examples/prompts.md).

### Gaya, look, dan layout

| Pengaturan | Menentukan | Contoh |
|---|---|---|
| `style` | Cara iklan memakai foto, footage, dan suara | `motion`, `ugc`, `hybrid` |
| `look` | Font, warna, caption, dan perlakuan visual | `luxe-editorial`, `warm-organic`, `ugc-native` |
| Layout | Susunan gambar dan teks di tiap adegan | Split screen, kolase, ponsel, callout |

Isi `style:` dan `look:` di brief atau sebutkan di prompt. Agen memilih dua sampai empat layout
per film dan mencatatnya dalam rencana adegan. Warna brand bisa menimpa look, tetapi tetap harus
lolos pengecekan kontras. Perubahan konsep yang sudah disetujui pada mode checkpoint memerlukan
persetujuan ulang.

[Katalog visual](showcase.id.md#look-dan-layout) ·
[Arahan look](../skills/vertical-product-ads/references/looks.md) ·
[Resep layout](../skills/vertical-product-ads/references/layouts.md)

### Durasi

Durasi bawaan 30 detik; iklan produksi harus 15–60 detik. Di atas 34 detik, konsep wajib
menjelaskan alasannya. Hook tampil dalam tiga detik pertama; CTA ditahan tiga sampai lima detik.
Versi pendek Reels dibuat sebagai proyek terpisah.
[Panduan platform dan sumber](../skills/ad-concept/references/duration-and-platforms.md).

## Suara dan musik

ElevenLabs bersifat opsional. Film bisa memakai pilihan gratis berikut, tetapi periksa ketentuan
setiap layanan sebelum memakai hasilnya untuk iklan berbayar.

| Bagian | ElevenLabs | Pilihan gratis atau lokal |
|---|---|---|
| Voice-over | `vo.engine: "elevenlabs"` | `vo.engine: "edge"`, melalui edge-tts; perlu internet |
| Musik | `music.prompt` | `music.synth`, atau file musik berlisensi milik Anda |
| Efek suara | Prompt `sfx` | Cue sintesis bawaan atau file milik Anda |
| Transkripsi footage | `dialogue.transcriber: "elevenlabs"` | `"whisper"`, melalui faster-whisper; berjalan offline |

Transkripsi `"auto"` memakai ElevenLabs bila tersedia, selain itu Whisper lokal.
Musik lokal dan cue sintesis dibuat di komputer Anda. Hasil ElevenLabs mengikuti ketentuan paket
Anda. edge-tts adalah klien tidak resmi layanan baca-teks Edge milik Microsoft; ketentuan penggunaan
komersialnya belum jelas. Utamakan untuk draf sampai ketentuannya Anda pastikan.

### API key ElevenLabs

Jangan tempel key ke chat atau prompt agen. Buat di dashboard ElevenLabs dengan izin layanan yang
dibutuhkan, lalu jalankan sendiri di terminal folder kerja Anda:

```bash
"$SKILL/scripts/set_key.sh"
```

Skrip menerima input tersembunyi, menyimpan key ke `.env` dengan mode `600`, dan menambahkan `.env`
ke `.gitignore`. `check_setup.sh` melaporkan lokasi key, bukan isinya, serta memperingatkan izin
file yang tidak aman atau aturan ignore yang belum ada. Tool membacanya dari environment atau
`.env` terdekat; agen tidak boleh membaca atau menampilkan key. Jika key terlanjur masuk chat,
cabut lalu buat yang baru.

## Render

Biasanya agen menjalankan langkah ini. Untuk mencoba pipeline secara manual, salin contoh tanpa aset:

```bash
cp -r "$SKILL/examples/minimal" my-ad
"$SKILL/scripts/make.sh" my-ad preview
```

Tinjau `my-ad/snaps/sheet.png` dan `my-ad/renders/draft.mp4`, lalu render:

```bash
"$SKILL/scripts/make.sh" my-ad final my-ad/out.mp4
```

Contoh minimal adalah demo pipeline 8,5 detik, bukan durasi iklan produksi. Tidak memerlukan
aset produk atau API key.

Untuk iklan sendiri, ganti `my-ad` dengan folder proyeknya. Preview membuat contact sheet dan draf
setengah ukuran dengan suara; final menghasilkan MP4 penuh dan storyboard. Pengecekan yang gagal
menghentikan build. Tonton video akhir dan dengarkan audionya sebelum tayang.

[Pengecekan kualitas dan batasan](technical.id.md#pengecekan-kualitas) ·
[Referensi produksi](../skills/vertical-product-ads/references/render-and-qa.md)
