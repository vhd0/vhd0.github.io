# vhd0.github.io

Trang GitHub Pages cá nhân.

## Hướng dẫn setup

1. Tạo repository trên GitHub với tên **chính xác**: `vhd0.github.io`
   (repo dạng `<username>.github.io` sẽ tự động được GitHub Pages nhận diện là trang chính)

2. Đẩy các file này lên repo:
   ```bash
   cd vhd0.github.io
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/vhd0/vhd0.github.io.git
   git push -u origin main
   ```

3. Vào repo trên GitHub → **Settings** → **Pages**
   - Source: chọn branch `main`, thư mục `/ (root)`
   - Nhấn **Save**

4. Sau 1-2 phút, trang sẽ chạy tại: **https://vhd0.github.io**

## Cấu trúc file

- `index.html` — trang chủ
- `style.css` — style cho trang
- `.nojekyll` — báo cho GitHub Pages không xử lý qua Jekyll (giữ nguyên file như thường)
- `README.md` — file này

## Chỉnh sửa nội dung

Mở `index.html` và sửa nội dung trong thẻ `<main>`. Mỗi lần `git push` lên `main`, trang sẽ tự động cập nhật sau ít phút.
