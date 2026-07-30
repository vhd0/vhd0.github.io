# vhd0.github.io

Trang GitHub Pages hiển thị nội dung repo dưới dạng **danh sách file/thư mục kiểu trình quản lý FTP** — đơn giản, không popup, không overlay.

## Cách hoạt động

`app.js` gọi GitHub API để lấy danh sách file trong repo `vhd0/vhd0.github.io`, hiển thị thành danh sách dòng: bấm vào thư mục để đi vào (có dòng `..` để quay lại thư mục cha), bấm vào file để xem nội dung ngay trong cùng khung — không dùng cửa sổ nổi, nên nút "quay lại" luôn hoạt động.

**Ví dụ:** publish file tại `abp/abp.txt` → trang tự hiện thư mục `abp`, bấm vào sẽ thấy file `abp.txt` bên trong. Chỉ cần `git push`, không cần sửa code.

### File setup không hiển thị

Khai báo trong `EXCLUDE_NAMES` ở đầu `app.js`: `index.html`, `style.css`, `app.js`, `README.md`, `.nojekyll`, `.gitignore`, `LICENSE`, `CNAME`, `favicon.ico`, `404.html`. Muốn ẩn thêm, thêm tên (viết thường) vào danh sách đó.

## Setup

1. Tạo repository trên GitHub tên **chính xác**: `vhd0.github.io`
2. Đẩy các file này lên:
   ```bash
   cd vhd0.github.io
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/vhd0/vhd0.github.io.git
   git push -u origin main
   ```
3. Vào repo → **Settings → Pages** → Source: branch `main`, thư mục `/ (root)` → **Save**
4. Sau 1-2 phút, trang chạy tại: **https://vhd0.github.io**

## Cấu trúc file

- `index.html` — khung trang (thanh path, ô tìm kiếm, khu vực danh sách/nội dung)
- `style.css` — giao diện đơn giản, sáng màu, kiểu trình quản lý file
- `app.js` — toàn bộ logic: gọi API, dựng danh sách, xem file, tìm kiếm
- `.nojekyll` — tắt xử lý Jekyll
- `README.md` — file này

## Lưu ý

- Repo cần ở chế độ **public** để GitHub API đọc được (không cần đăng nhập). Nếu chuyển sang private, trang sẽ không tải được nội dung.
- GitHub API công khai giới hạn 60 lượt gọi/giờ/IP — trang chỉ gọi 1 lần khi tải trang nên hiếm khi chạm giới hạn.
