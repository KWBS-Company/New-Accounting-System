# 📦 Project Setup

## 📥 Clone the Repository

```bash
git clone <repository-url>
cd <repository-folder>
```

---

## 📁 Navigate to Backend

```bash
cd backend
```

---

## 🐍 Create Virtual Environment

```bash
python -m venv as-venv
```

---

## ⚡ Activate Virtual Environment

### macOS / Linux

```bash
source ./as-venv/bin/activate
```

### Windows

```bash
as-venv\Scripts\activate
```

---

## 📥 Install Dependencies

```bash
pip install -r requirements.txt
```

---

## 🚀 Run the Application

```bash
python main.py
```

---

## 📚 API Documentation (Swagger)

Once the server is running, open:

```
http://localhost:3000/docs
```

---

## 🔐 Environment Variables

Create a `.env.local` file in the `backend` directory with the following content:

```env
APP_PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_DATABASE=your_database
DB_PORT=5432
DB_USERNAME=your_username
DB_PASSWORD=your_password
```

---

## 🧠 Notes

* Always activate the virtual environment before running the app
* Ensure `.env.local` is correctly configured before starting the server
* If you install new packages:

```bash
pip freeze > requirements.txt
```
