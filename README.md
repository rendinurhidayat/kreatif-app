# Kreatif

App iPhone (dan nanti Android) untuk mengelola proyek kreatif bersama tim dan keuangan pribadi/bisnis.
Dibuat dengan Expo (React Native) dan Supabase.

## Status

- Tahap 1 (Fondasi): login, daftar akun, dan tiga tab (Proyek, Keuangan, Akun).
- Tahap 2 (Keuangan): buku Bisnis dan Pribadi terpisah, pemasukan dan pengeluaran per kategori, saldo dan ringkasan bulan ini, hutang dan piutang. Tekan lama transaksi untuk menghapus.
- Tahap 3 (Proyek tim): buat tim, undang anggota lewat email, proyek dengan tahapan Brief sampai Lunas, jadwal shooting dan deadline, tugas per anggota, link file. Pemasukan bisnis bisa ditandai ke proyek. Anggota tim tidak bisa melihat keuangan.
- Tahap 4 (Laporan dan rilis): laporan grafik (laba 6 bulan, masuk/keluar per bulan, pengeluaran per kategori, pemasukan per proyek), pengingat jam 09:00 (H-1 shooting dan deadline, hari H tugas dan hutang), invoice PDF dari halaman proyek, serta konfigurasi rilis (EAS).

## Versi lengkap

Tampilan minimalis yang mengikuti mode terang/gelap iPhone, pemilih tanggal bawaan, dan semua data bisa diedit.

- **Proyek**: papan per tahapan, jadwal shooting dan deadline, tugas per anggota, link file, undang tim.
- **Keuangan**: buku Bisnis dan Pribadi, pilih bulan, pindah saldo antar buku, hutang dan piutang, laporan 6/12 bulan, ekspor CSV.
- **Invoice**: nomor otomatis, beberapa baris item, diskon, DP, jatuh tempo, Terms and Conditions, PDF untuk dibagikan, tandai lunas otomatis jadi pemasukan Bisnis.
- **Akun**: profil usaha (nama, kontak, rekening, T&C bawaan), pengingat jam 09:00.

## Tampilan interaktif

Teks memakai Helvetica Neue, angka memakai Plus Jakarta Sans. Kartu pastel, tab bar gelap, animasi halus.

- **Beranda**: ringkasan pemasukan, laba, invoice belum dibayar, proyek aktif, grafik pendapatan, cashflow, dan pengeluaran. Ketuk grafik untuk melihat angka detail.
- **Geser** baris transaksi, hutang, invoice, dan tugas ke kiri atau kanan untuk tandai lunas/selesai atau hapus.
- **Tekan lama** kartu proyek untuk memindahkan tahapannya.
- Form tambah cepat muncul sebagai lembar dari bawah yang bisa ditarik.

## Pakai di iPhone lewat web (tanpa Apple Developer)

App ini bisa dibuka di Safari dan dipasang di layar utama seperti app biasa.

1. Di terminal VS Code (folder project, file `.env` sudah berisi URL dan key Supabase):
   `npm install` lalu `npx expo export --platform web`. Hasilnya folder `dist`.
2. Buka [app.netlify.com/drop](https://app.netlify.com/drop), daftar gratis, lalu seret folder `dist` ke halaman itu. Kamu dapat alamat seperti `nama-acak.netlify.app` (bisa diganti di Site configuration > Change site name).
3. Di Supabase: Authentication > URL Configuration, isi Site URL dengan alamat Netlify tadi supaya link konfirmasi email mengarah ke app.
4. Di iPhone, buka alamat itu di Safari, tekan tombol Bagikan, lalu "Add to Home Screen".

Update versi: ulangi langkah 1, lalu di Netlify buka site-nya > Deploys dan seret folder `dist` yang baru.

Yang berbeda di versi web: pengingat jam 09:00 tidak ada, getaran halus tidak ada, PDF invoice dibuka lewat dialog cetak (pilih Simpan sebagai PDF atau Bagikan), dan CSV langsung terunduh.

## Impor proyek dari CSV

Di tab Proyek, tekan ikon awan. Kolom yang dikenali: Nama (wajib), Klien, Jenis, Tahapan, Shooting, Deadline, Link, Catatan. Dari Google Sheets: File > Download > CSV. Tombol "Unduh template" memberi contoh file.

## Asisten AI (opsional)

Asisten menjawab pertanyaan soal proyek dan keuangan. Bisa memakai Gemini (ada kuota gratis) atau Claude (berbayar, jawaban lebih teliti). API key disimpan di Supabase, tidak pernah ada di app.

1. Ambil API key:
   - Gemini gratis: [aistudio.google.com/apikey](https://aistudio.google.com/apikey), lalu Create API key.
   - Atau Claude: [console.anthropic.com](https://console.anthropic.com), isi saldo di Billing, lalu buat API key.
2. Di Supabase: Edge Functions > Secrets, tambahkan `GEMINI_API_KEY` (atau `ANTHROPIC_API_KEY`) berisi key tadi. Kalau dua-duanya diisi, Claude yang dipakai.
3. Edge Functions > Deploy a new function > Via Editor. Beri nama `asisten`, tempel isi `supabase/functions/asisten/index.ts`, lalu Deploy.
4. Buka app, tekan ikon ✨ di Beranda.

Catatan Gemini gratis: ada batas jumlah pertanyaan per menit dan per hari, dan Google boleh memakai data yang dikirim untuk melatih modelnya. Kalau keberatan data keuangan ikut terkirim, aktifkan billing di Google AI Studio atau pakai Claude.

## Menyiapkan Supabase (sekali saja)

1. Buat proyek baru di https://supabase.com (paket gratis cukup).
2. Buka **SQL Editor**, jalankan file di folder `supabase/` berurutan: tempel isi `001_profiles.sql`, klik **Run**, lalu ulangi untuk `002_keuangan.sql`, `003_proyek.sql`, dan `004_lengkap.sql`. Skrip aman dijalankan ulang.
3. Supaya cepat saat mencoba, matikan konfirmasi email: **Authentication > Sign In / Providers > Email > Confirm email** (off).
4. Buka **Project Settings > API**, salin **Project URL** dan **anon / publishable key**.

## Menjalankan di iPhone

Butuh laptop (Windows atau Mac) dengan [Node.js](https://nodejs.org) versi LTS, dan app **Expo Go** di iPhone.

```bash
npm install
cp .env.example .env   # lalu isi URL dan key dari Supabase
npx expo start
```

Scan QR code yang muncul dengan kamera iPhone. Laptop dan iPhone harus di Wi-Fi yang sama.

## Rilis ke iPhone tim (TestFlight)

Selama masih mencoba, Expo Go sudah cukup. Supaya tim bisa memasang app seperti app biasa:

1. Daftar [Apple Developer Program](https://developer.apple.com/programs/) ($99/tahun).
2. Di laptop: `npm install -g eas-cli`, lalu `eas login` (akun Expo gratis).
3. Simpan URL dan key Supabase di Expo: `eas env:create` untuk `EXPO_PUBLIC_SUPABASE_URL` dan `EXPO_PUBLIC_SUPABASE_KEY` (pilih environment preview dan production).
4. `eas build --platform ios --profile production`, ikuti pertanyaannya (login Apple).
5. `eas submit --platform ios`, lalu undang tim di App Store Connect > TestFlight.

Android: `eas build --platform android --profile preview` menghasilkan file APK yang bisa langsung dipasang.

## Struktur

- `src/app/` layar app (Expo Router): `login.tsx`, `(tabs)/` untuk Proyek, Keuangan, Akun, plus layar transaksi, hutang, proyek, tim, laporan, invoice
- `src/lib/` koneksi Supabase, status login, data keuangan dan proyek, pengingat, komponen tampilan
- `supabase/` skrip SQL database, dijalankan berurutan
