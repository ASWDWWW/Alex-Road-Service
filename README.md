# Alex Road Service — Public Website

Public marketing website for Alex Road Service: 24/7 emergency roadside repair and commercial truck repair. Built for Firebase Hosting.

---

## Run on localhost

Serve the site locally with Python (no install needed if you have Python 3):

```bash
cd public
python3 -m http.server 3000
```

Then open in your browser: **http://localhost:3000**

To stop the server, press `Ctrl+C` in the terminal.

**Alternative (Node.js):**

```bash
npx serve public -l 3000
```

Then open **http://localhost:3000**

---

## Deploy to Firebase

### 1. Install Firebase CLI (if needed)

```bash
npm install -g firebase-tools
```

### 2. Login

```bash
firebase login
```

### 3. Set your project ID

Edit `.firebaserc` and set `"default"` to your Firebase project ID:

```json
{
  "projects": {
    "default": "your-firebase-project-id"
  }
}
```

### 4. Deploy

```bash
firebase deploy --only hosting
```

Your site will be live at `https://your-project-id.web.app` (and your custom domain if configured in Firebase).

---

## Before going live — update these

### In `public/js/components.js`

Update the `SITE` object at the top with your real business details:

| Variable       | What to set |
|----------------|-------------|
| `phone`        | Main shop phone (display) |
| `phoneTel`     | Same number as `tel:` link (e.g. `tel:+12145550100`) |
| `phoneEmerg`   | 24/7 emergency line (display) |
| `phoneTelEmg`  | Same emergency number as `tel:` link |
| `email`        | Contact email |
| `address`       | Full shop address |
| `hours`        | Shop and emergency hours text |
| `mapEmbed`     | Google Maps embed URL for your actual location |

These values drive the banner, nav, footer, and contact blocks site-wide.

### In `public/js/firebase-config.js`

Replace the placeholder Firebase config with your project’s values from **Firebase Console → Project settings → Your apps**:

- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`
- `measurementId` (optional, for Analytics)

### In `public/login.html`

The login page has its own Firebase config block (in the `<script type="module">` at the bottom). Replace the same placeholders with your Firebase project credentials so staff can sign in.

---

## Firestore (optional)

If you use the contact form with Firebase:

1. In Firebase Console, create a Firestore database.
2. Create a collection named `contact_submissions` (or change the name in `firebase-config.js` to match your collection).
3. Set Firestore rules so only your app (or admin) can read; the client can write contact submissions.

---

## Project structure

```
Alex-Road-Service/
├── public/           # Static site (deployed to Firebase)
│   ├── index.html    # Home
│   ├── about.html
│   ├── services.html
│   ├── emergency.html
│   ├── commercial.html
│   ├── contact.html
│   ├── reviews.html
│   ├── financing.html
│   ├── login.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── components.js   # Nav + footer (update SITE here)
│       ├── main.js
│       └── firebase-config.js
├── firebase.json
├── .firebaserc        # Set your project ID here
└── README.md
```
