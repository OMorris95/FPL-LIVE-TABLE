# Quick Start Guide - FPL Stats Hub

## 🚀 Getting Started in 3 Steps

### 1. Open the Website

**Option A: Direct File (Simplest)**
Simply open `index.html` in your web browser:
- Double-click `index.html`, or
- Right-click → Open with → Your browser
- The site will use hash-based URLs like `file:///.../index.html#/live-table`

**Option B: Local Development Server (Recommended)**
For a better experience that matches deployment:
1. Double-click `serve.bat` (Windows), or
2. Run `python serve.py` in terminal
3. Open http://localhost:8000 in your browser
4. The site will use clean URLs like `http://localhost:8000/live-table`

### 2. Enter Your League ID
1. Go to [fantasy.premierleague.com](https://fantasy.premierleague.com)
2. Click on "Leagues" and select your league
3. Look at the URL: `https://fantasy.premierleague.com/leagues/314/standings/c`
4. Copy the number (e.g., `314`)
5. Paste it into the FPL Stats Hub homepage

### 3. Explore!
Navigate through the menu to see:
- **Live Table**: Real-time league standings
- **Dream Team**: Optimal XI from your league
- **League Stats**: Captain picks, ownership, chips
- **Compare**: Head-to-head manager analysis

## 📱 Features at a Glance

### Live Table
- Shows live points as matches are played
- Click any manager to see their full team
- See who's using chips this gameweek

### Dream Team
- Automatically calculates the best possible 11 from all teams in your league
- Shows Player of the Week
- Tests all valid FPL formations (3-4-3, 4-4-2, etc.)

### League Stats
- **Most Captained**: See who everyone is captaining
- **Ownership**: Find the most and least owned players
- **Chip Tracker**: See who's used their chips

### Manager Comparison
- Pick any 2 managers to compare
- See squad overlap
- Compare points, ranks, and strategies

## 🔧 Troubleshooting

### "Error fetching data"
- Check your internet connection
- The CORS proxy might be down - try refreshing
- Make sure you entered a valid League ID

### Page looks broken
- Make sure all files are in the correct folders
- Check browser console for errors (F12)
- Try using the local development server (`serve.bat` or `python serve.py`)

### Router errors (SecurityError, pushState)
- This happens when opening `index.html` directly in some browsers
- **Fixed**: The router now automatically uses hash-based routing for local files
- If issues persist, use the local development server: `python serve.py`

### No live points showing
- Live points only update during active gameweeks
- Outside of gameweeks, the site will show the next gameweek

## 🌐 Deploying Online

Want to share with your league?

### Option 1: GitHub Pages (Free)
1. Create a GitHub account
2. Create a new repository
3. Upload all files
4. Go to Settings → Pages
5. Select "main" branch
6. Your site will be at: `https://yourusername.github.io/repo-name`

### Option 2: Netlify (Free, No Git Required)
1. Go to [netlify.com](https://netlify.com)
2. Drag and drop your entire folder
3. Get a free URL instantly

### Option 3: Vercel (Free)
Similar to Netlify - just upload and deploy!

## 💡 Tips

- **Bookmark your league**: The URL includes your league ID, so bookmark it for quick access
- **Refresh during matches**: Click the refresh button on Live Table to see live updates
- **Share with league mates**: Once deployed, share the link with your league!
- **Check Dream Team weekly**: See which players are performing best in your league

## ❓ Common Questions

**Q: Is this safe to use?**
A: Yes! It only reads public FPL data. It doesn't access your account or make any changes.

**Q: Will it work on mobile?**
A: Yes, but the desktop experience is better for now. Mobile improvements are coming in Phase 3!

**Q: How often does data update?**
A: Every time you refresh the page, it fetches the latest data from FPL.

**Q: Can I use it for multiple leagues?**
A: Yes! Just enter a different League ID to switch leagues.

**Q: Does it cost anything?**
A: No, it's completely free!

---

Enjoy your FPL Stats Hub! 🏆⚽
