import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './i18n/i18n';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Log the deployed version + build time so it's easy to confirm a new deploy is live.
console.log(
  `%cChessAnalytics%c v${process.env.REACT_APP_VERSION || 'dev'} %c· build ${process.env.REACT_APP_BUILD_TIME || 'local'}`,
  'color:#01B6FF;font-weight:bold',
  'color:#E5E7E9;font-weight:bold',
  'color:#94a3b8'
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
