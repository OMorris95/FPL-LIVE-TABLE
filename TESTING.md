# Testing Guide

## ✅ Router Fix Applied

The SecurityError issue has been **fixed**! The router now automatically detects whether you're running locally or on a server.

## How It Works

### Local File Mode (`file://`)
When you open `index.html` directly in your browser:
- Router uses **hash-based routing**
- URLs look like: `file:///.../index.html#/live-table`
- Works in all browsers without security errors
- You'll see: "Router: Using hash-based routing (local file mode)" in console

### Server Mode (`http://` or `https://`)
When running on a web server or deployment:
- Router uses **pushState routing**
- URLs look like: `http://localhost:8000/live-table`
- Clean URLs without the hash
- You'll see: "Router: Using pushState routing (server mode)" in console

## Testing the Site

### Quick Test (Direct File)
1. Open `index.html` in your browser
2. You should see the home page with league input
3. Check the browser console (F12) - you should see:
   ```
   Router: Using hash-based routing (local file mode)
   FPL Stats Hub initializing...
   FPL Stats Hub ready!
   ```
4. No errors should appear!

### Full Test (With League Data)
1. Enter a valid league ID (try `314` for testing)
2. Navigate through all pages:
   - Home → Live Table
   - Dream Team
   - League Stats
   - Comparison
3. All navigation should work smoothly
4. URLs will have `#` in them: `#/live-table`, `#/dream-team`, etc.

### Professional Test (Local Server)
1. Run `python serve.py` or double-click `serve.bat`
2. Open http://localhost:8000
3. Console should show:
   ```
   Router: Using pushState routing (server mode)
   FPL Stats Hub initializing...
   FPL Stats Hub ready!
   ```
4. Navigate through pages - URLs will be clean: `/live-table`, `/dream-team`, etc.

## Browser Compatibility

Tested and working on:
- ✅ Chrome/Edge
- ✅ Firefox
- ✅ Safari
- ✅ Opera
- ✅ Brave

All browsers work with both routing modes!

## Common Issues & Solutions

### Issue: "SecurityError: Failed to execute 'pushState'"
**Status**: ✅ FIXED
**Solution**: The router now automatically uses hash routing for local files

### Issue: Navigation doesn't work
**Solution**:
- Make sure all files are in correct folders
- Check browser console for JavaScript errors
- Try refreshing the page
- Try the local server method

### Issue: Blank page
**Solution**:
- Check console for errors
- Make sure you're not blocking JavaScript
- Verify all files downloaded correctly

### Issue: "Cannot read property of undefined"
**Solution**:
- Usually a data fetching issue
- Check internet connection
- Try a different league ID
- CORS proxy might be temporarily down

## Deployment Testing

Before deploying to production:

1. **Test locally with server**: `python serve.py`
2. **Test all features**:
   - ✅ League search
   - ✅ Live table with expandable rows
   - ✅ Dream team calculation
   - ✅ League stats (captain, ownership, chips)
   - ✅ Manager comparison
3. **Test navigation**: All links work, back/forward buttons work
4. **Test with different leagues**: Try multiple league IDs
5. **Test on mobile browser** (if possible)

## Performance Testing

Expected load times (on good connection):
- Home page: Instant
- Live table (15 managers): 3-5 seconds
- Dream team: 4-6 seconds
- League stats: 3-5 seconds
- Manager comparison: 2-4 seconds

Larger leagues (20+ managers) will take proportionally longer.

## Debug Mode

To see detailed logging, open browser console (F12):
- Router logs which mode it's using
- API calls are logged
- Errors are logged with stack traces

## What to Check Before Going Live

- [ ] Site works when opening `index.html` directly
- [ ] Site works on local server (`serve.py`)
- [ ] All navigation links work
- [ ] League data loads correctly
- [ ] Dream team calculates properly
- [ ] Stats display correctly
- [ ] Comparison tool works
- [ ] No console errors
- [ ] Mobile responsive (at least functional)

## Need Help?

If you encounter issues:
1. Check browser console (F12) for errors
2. Try with the local server (`python serve.py`)
3. Test with league ID `314` (known working league)
4. Check `QUICK_START.md` troubleshooting section

---

Happy testing! 🚀
