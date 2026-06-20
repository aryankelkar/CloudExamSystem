# Cloud-Based Online Examination & Analytics System

A modern, cloud-based examination platform built with React.js, Material UI, and Firebase. This system provides a comprehensive solution for conducting online examinations, automatic evaluation, and detailed analytics.

## 🚀 Features

### For Faculty
- **Exam Management**: Create, edit, and delete exams with ease
- **Question Bank**: Add multiple-choice questions with correct answers
- **Analytics Dashboard**: Comprehensive charts and insights
- **Results Management**: View and analyze student performance
- **Cost Monitoring**: Track cloud resource usage and costs
- **Real-time Updates**: Monitor exam participation and completion

### For Students
- **Online Examination**: Take exams with a professional interface
- **Timer**: Built-in countdown timer for time management
- **Question Palette**: Easy navigation between questions
- **Instant Results**: View scores and performance immediately after submission
- **Performance Analytics**: Detailed breakdown of performance
- **Download Reports**: Export result reports

## 🛠️ Tech Stack

- **Frontend**: React.js 18.3.1
- **Routing**: React Router DOM 7.17.0
- **UI Framework**: Material UI (MUI) 5.15.20
- **Charts**: Recharts 3.8.1
- **Authentication**: Firebase Authentication (prepared)
- **Database**: Firestore (prepared)
- **Styling**: CSS-in-JS with Material UI + Custom CSS

## 📁 Project Structure

```
src/
├── components/          # Reusable components
│   ├── Navbar.jsx
│   ├── Sidebar.jsx
│   ├── Footer.jsx
│   ├── ExamCard.jsx
│   ├── ResultCard.jsx
│   ├── Timer.jsx
│   ├── QuestionPalette.jsx
│   ├── LoadingSpinner.jsx
│   └── ProtectedRoute.jsx
├── pages/              # Page components
│   ├── LandingPage.jsx
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   ├── StudentDashboard.jsx
│   ├── FacultyDashboard.jsx
│   ├── ExamPage.jsx
│   ├── ResultPage.jsx
│   ├── CreateExamPage.jsx
│   ├── ManageExamPage.jsx
│   ├── AnalyticsPage.jsx
│   ├── BillingPage.jsx
│   ├── ProfilePage.jsx
│   └── NotFoundPage.jsx
├── layouts/            # Layout components
│   ├── StudentLayout.jsx
│   └── FacultyLayout.jsx
├── routes/             # Route configuration
│   └── AppRoutes.jsx
├── services/           # API services (prepared for Firebase)
│   ├── authService.js
│   ├── examService.js
│   ├── resultService.js
│   └── analyticsService.js
├── firebase.js         # Firebase configuration
├── App.js              # Main app component
└── index.js            # Entry point
```

## 📦 Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Steps

1. **Navigate to the frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

   The following packages are included:
   - `react-router-dom` - Client-side routing
   - `@mui/material` - Material UI components
   - `@mui/icons-material` - Material UI icons
   - `@emotion/react` & `@emotion/styled` - Emotion styling
   - `recharts` - Chart library
   - `firebase` - Firebase SDK

3. **Start the development server**
   ```bash
   npm start
   ```

   The application will open at [http://localhost:3000](http://localhost:3000)

## 🔧 Configuration

### Firebase Configuration

The Firebase configuration is already set up in `src/firebase.js`. To connect to your own Firebase project:

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication (Email/Password)
3. Create Firestore Database
4. Copy your Firebase config
5. Replace the config in `src/firebase.js`

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## 🎯 Usage



### Firebase Integration (Future)

To enable Firebase integration:

1. Uncomment the Firebase functions in service files
3. Set up Firestore collections:
   - `users` - User profiles
   - `exams` - Exam data
   - `results` - Exam results
   - `analytics` - Analytics data

## 📱 Responsive Design

The application is fully responsive and works on:
- Desktop (1920px+)
- Laptop (1024px - 1920px)
- Tablet (768px - 1024px)
- Mobile (320px - 768px)

## 🎨 Cloud-Themed Design

The application features a modern cloud-themed design with:
- Purple gradient color scheme
- Smooth animations and transitions
- Card-based layouts
- Custom scrollbars
- Hover effects
- Loading animations

## 🔐 Authentication

Authentication is prepared for Firebase integration. Currently using mock authentication:
- Registration with validation
- Login with role selection (Student/Faculty)
- Session management
- Protected routes

## 📊 Analytics Dashboard

The analytics dashboard includes:
- Average marks by subject
- Pass vs fail statistics
- Top students leaderboard
- Exam participation rates
- Subject performance comparison
- Monthly trends

## 💰 Cost Monitoring

The billing page demonstrates cloud cost monitoring:
- Budget tracking
- Usage progress
- Alert thresholds (50%, 75%, 90%, 100%)
- Cost breakdown by service

## 🚀 Deployment

### Build for Production

```bash
npm run build
```

This creates an optimized production build in the `build/` folder.

### Deploy to Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init
firebase deploy
```

### Deploy to Other Platforms

The `build/` folder can be deployed to:
- Netlify
- Vercel
- AWS S3
- GitHub Pages
- Any static hosting service

## 🧪 Testing

```bash
npm test
```

Run tests in interactive watch mode.

## 📝 Available Scripts

- `npm start` - Start development server
- `npm test` - Run tests
- `npm run build` - Build for production
- `npm run eject` - Eject from Create React App (one-way operation)

## 🔮 Future Enhancements

- **Cloud Functions**: Backend logic for exam processing
- **Cloud Storage**: File uploads for exam materials
- **BigQuery Integration**: Advanced analytics
- **Looker Studio**: Enhanced visualization
- **Real-time Features**: Live exam monitoring
- **Email Notifications**: Exam reminders and results
- **Multi-language Support**: Internationalization
- **Mobile App**: React Native version

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👥 Support

For support and questions, please open an issue in the repository.

## 🙏 Acknowledgments

- React.js team
- Material UI team
- Firebase team
- Recharts team
