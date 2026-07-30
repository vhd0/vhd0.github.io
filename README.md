# vhd0.github.io

Trang GitHub Pages hiển thị **nội dung bạn lưu trong repo dưới dạng thẻ mục lục** (kiểu tủ hồ sơ lưu trữ) — duyệt theo thư mục, tự động cập nhật, không cần build.

## Cách hoạt động

`app.js` gọi GitHub API (`/git/trees/main?recursive=1`) để lấy toàn bộ file trong repo `vhd0/vhd0.github.io`, dựng thành cây thư mục rồi hiển thị dạng lưới thẻ theo từng cấp — bấm vào thư mục để đi vào trong, bấm vào file để xem nội dung (text, markdown, ảnh) ở lớp overlay.

**Ví dụ:** publish file tại `abp/abp.txt` → trang tự hiện thư mục `abp`, bấm vào sẽ thấy file `abp.txt` bên trong. Không cần sửa code, chỉ cần `git push`.

### File setup không hiển thị

Các file dùng để dựng trang được loại khỏi danh sách hiển thị (khai báo trong `EXCLUDE_NAMES` ở đầu `app.js`):
`index.html`, `style.css`, `app.js`, `README.md`, `.nojekyll`, `.gitignore`, `LICENSE`, `CNAME`, `favicon.ico`, `404.html`.

Muốn ẩn thêm file/thư mục nào, thêm tên (viết thường) vào danh sách `EXCLUDE_NAMES` trong `app.js`.

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

- `index.html` — khung giao diện (topbar, sidebar cây thư mục, panel xem file)
- `style.css` — giao diện kiểu terminal tối màu
- `app.js` — gọi GitHub API, dựng cây thư mục, xử lý xem file (text/markdown/ảnh), tìm kiếm/lọc file
- `.nojekyll` — tắt xử lý Jekyll, giữ nguyên file tĩnh
- `README.md` — file này

## Lưu ý

- GitHub API công khai (không đăng nhập) giới hạn **60 request/giờ/IP**. Trang chỉ gọi 1 request khi tải, nên hiếm khi bị giới hạn trừ khi tải lại liên tục.
- Repo có thể **public hoặc private**, nhưng nếu private, GitHub API sẽ không trả được dữ liệu vì trang không có xác thực (token). Nếu cần dùng với repo private, cần bổ sung cơ chế xác thực riêng — có thể yêu cầu tôi hỗ trợ thêm.
- Muốn đổi tên chủ repo/nhánh khác, sửa 3 biến `OWNER`, `REPO`, `BRANCH` ở đầu file `app.js`.
