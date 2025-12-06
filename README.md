# Intelligent Briefing Orchestrator

## Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- Google Cloud Project with Gemini API enabled

### Backend
1. Navigate to `backend/`
2. Create `.env` file:
   ```
   GOOGLE_API_KEY=your_key_here
   ```
3. Install dependencies:
   ```bash
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
4. Run server:
   ```bash
   uvicorn app.main:app --reload
   ```

### Frontend
1. Navigate to `frontend/`
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run development server:
   ```bash
   npm run dev
   ```

