# Contoh prompt

Prompt siap salin untuk setiap gaya. Semuanya memakai produk fiktif **Glowa Lip Serum**; ganti
bagian dalam `[...]`. Prompt boleh dalam bahasa apa pun.

Dua cara memberi informasi:
- **Dengan `brief.md`:** prompt pendek, detail ada di file (contoh: [`brief-motion.md`](brief-motion.md),
  [`brief-ugc.md`](brief-ugc.md), [`brief-hybrid.md`](brief-hybrid.md)).
- **Tanpa `brief.md`:** semua detail di prompt. Agent menulis `brief.md` sendiri dari isi prompt.

Agar hasil tidak melenceng, prompt (atau brief) memuat **5 hal wajib**: produk (nama, varian, apa
itu), klaim + sumbernya, CTA persis, target + platform, lokasi aset. Kurang satu: mode checkpoint
akan menanyakannya sekali; mode autopilot akan mengasumsikannya (dicatat sebagai `ASSUMPTION:`).

## Aset per gaya
| | `motion` | `ugc` | `hybrid` |
|---|---|---|---|
| **Wajib** | Foto produk ≥ 3 sudut, ≥ 2000 px, latar putih/transparan, tanpa teks | Footage kreator 9:16 1080×1920, 30 fps, bicara ke kamera, audio bersih tanpa musik ([shot list](../templates/creator-shot-list.md)) | Footage kreator (min. hook + testimoni) **dan** foto produk seperti motion |
| **Disarankan** | Logo, warna brand (hex), close-up tekstur ≥ 1600 px, satu foto per shade/varian | 2–4 b-roll 3–6 dtk (putar produk, cara pakai, tekstur), 1 packshot untuk end card | b-roll, tekstur, foto shade |
| **Suara** | VO: ElevenLabs atau gratis (edge-tts) | Suara kreator di footage | Suara kreator |
| **Izin** | Foto model, jika ada | Izin tampil kreator | Keduanya |

## Look
Gaya (`motion`/`ugc`/`hybrid`) menentukan cara produksi; **look** menentukan tampilannya: font, warna,
bentuk chip dan tombol, caption, dan cara teks muncul. Pilihan: `classic`, `luxe-editorial`,
`clean-clinical`, `bold-streetwear`, `warm-organic`, `tech-neon`, `pop-playful`, `ugc-native`
(penjelasan di [`references/looks.md`](../references/looks.md)). Sebut di prompt ("pakai look
bold-streetwear") atau di `brief.md` (`look:`). Kosong: agent memilih dari kategori produk dan nada
brand, lalu menuliskan alasannya di konsep.

## Layout
Dalam satu iklan, tiap beat bisa memakai layout berbeda: split screen (sebelum/sesudah), grid,
picture-in-picture (kreator tetap bicara di jendela kecil), kolase, tumpukan kartu, mockup ponsel
(halaman toko), callout bahan, daftar ✓/✗ perbandingan, teks berjalan (promo), dan teks berisi
gambar. Agent memilih 2–4 layout yang cocok dengan look; sebut di prompt kalau mau yang tertentu
("pakai split screen untuk sebelum/sesudah, dan ponsel untuk CTA").

## `motion`
**Pendek (dengan brief):**
> Buatkan iklan dari folder `iklan/glowa`. Brief ada di `brief.md`.

**Lengkap (tanpa brief), checkpoint, audio gratis:**
> Buatkan iklan TikTok 30 detik gaya motion untuk **Glowa Lip Serum**, serum bibir berwarna tipis
> (3 shade: Rose, Peach, Berry; Rp89.000 di TikTok Shop). Foto ada di `iklan/glowa/assets/`:
> packshot putih 3 sudut, 1 close-up tekstur, 3 foto shade. Target: perempuan 20–30 tahun yang
> bibirnya cepat kering dan tidak suka lipstik tebal. Klaim: "lembap hingga 24 jam" (uji internal
> Glowa, 30 responden). Warna brand #C2416B. CTA: "Cek keranjang kuning". Voice-over perempuan
> bahasa Indonesia, nada santai; suara dan musik gratis.

**Lengkap, autopilot, ElevenLabs:**
> Autopilot: iklan Shorts 20 detik gaya motion untuk **Glowa Lip Serum** dari folder
> `iklan/glowa` (foto di `assets/`). Target perempuan 20–30 tahun. Klaim "lembap hingga 24 jam"
> (uji internal Glowa, 30 responden). CTA "Link di bio". Voice-over ElevenLabs perempuan bahasa
> Indonesia, musik ElevenLabs ceria tanpa vokal.

## `ugc`
**Pendek (dengan brief):**
> Buatkan iklan UGC dari folder `iklan/glowa`. Brief di `brief.md`, footage kreator di `assets/`.

**Lengkap (tanpa brief), checkpoint:**
> Buatkan iklan TikTok 25 detik gaya UGC untuk **Glowa Lip Serum** dari footage kreator
> `iklan/glowa/assets/review.mp4` (9:16, ada satu take salah ucap yang harus dibuang). B-roll:
> `apply.mp4` (cara pakai) dan `swatch.mp4` (tekstur). Target: perempuan 18–25 tahun, pembeli
> TikTok Shop. Klaim: "lembap hingga 24 jam" (uji internal Glowa, 30 responden). Tambahkan caption
> per kata; tulis "Glowa" dengan G kapital. Tutup dengan `packshot.png` dan CTA "Cek keranjang
> kuning". Musik synth gratis, pelan di bawah suara kreator.

**Lengkap, autopilot:**
> Autopilot: iklan Reels 20 detik gaya UGC untuk **Glowa Lip Serum** dari `iklan/glowa/assets/review.mp4`.
> Pakai hook terkuat dari 3 variasi yang direkam, buang take yang salah, caption per kata, CTA
> "Link di bio". Target perempuan 18–25 tahun. Tanpa klaim angka. Musik gratis.

## `hybrid`
**Pendek (dengan brief):**
> Autopilot: buat iklan dari folder `iklan/glowa`, brief di `brief.md`.

**Lengkap (tanpa brief), autopilot:**
> Autopilot: buat iklan Reels 30 detik gaya hybrid untuk **Glowa Lip Serum**. Hook dari footage
> kreator `iklan/glowa/assets/review.mp4`, lalu kartu produk dari foto di `assets/` (3 sudut +
> 3 foto shade), klaim "lembap hingga 24 jam" dengan footnote "uji internal Glowa, 30 responden",
> lalu testimoni kreator, tutup dengan end card dan CTA "Link di bio". Target: perempuan 20–30
> tahun. Warna brand #C2416B. Musik dari ElevenLabs, ceria, tanpa vokal.

**Lengkap, checkpoint:**
> Buatkan iklan TikTok 30 detik gaya hybrid untuk **Glowa Lip Serum** dari folder `iklan/glowa`:
> footage kreator `review.mp4` untuk hook dan testimoni, foto produk dan shade untuk kartu produk.
> Klaim "lembap hingga 24 jam" (uji internal Glowa, 30 responden). CTA "Cek keranjang kuning".
> Target perempuan 20–30 tahun. Tunjukkan 3 hook dulu sebelum produksi.

## Prompt lanjutan
| Untuk | Prompt |
|---|---|
| Konsep saja | *Buatkan 3 hook dan konsep iklan untuk [produk] dari folder `iklan/[nama]`, jangan produksi dulu.* |
| Menyetujui konsep | *Setuju hook #2, lanjut produksi.* |
| Mengubah konsep | *Hook #1 tapi kalimatnya lebih pendek, dan jangan tampilkan harga. Tunjukkan lagi sebelum produksi.* |
| Ganti gaya | *Ubah iklan `iklan/[nama]` jadi hybrid, pakai `review.mp4` untuk hook.* |
| Ganti look | *Render ulang iklan `iklan/[nama]` dengan look tech-neon, warna brand tetap.* |
| Bandingkan look | *Buat 3 versi iklan `iklan/[nama]`: luxe-editorial, clean-clinical, pop-playful, masing-masing di proyek terpisah.* |
| Ganti layout | *Di iklan `iklan/[nama]`, ganti adegan bahan jadi callout yang menunjuk ke botol, dan tambahkan daftar ✓/✗ "kita vs biasa".* |
| Tambah PiP | *Waktu b-roll di detik 9–12, tampilkan kreator tetap bicara di jendela kecil kanan atas.* |
| Revisi setelah jadi | *Teks klaim di detik 18 terlalu kecil, dan CTA muncul terlalu cepat. Perbaiki lalu render ulang.* |
| Ganti suara | *Ganti voice-over ke suara laki-laki, sisanya sama.* |
| Versi pendek | *Buat versi 15 detik dari iklan `iklan/[nama]` untuk Reels, sebagai proyek terpisah `iklan/[nama]-15s`.* |
| Minta shot list | *Saya mau gaya UGC tapi belum punya footage. Buatkan shot list untuk kreator saya.* |
