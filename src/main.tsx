import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

// Simple test component
const TestApp = () => {
  return (
    <div style={{ padding: '20px', background: '#f0f0f0', minHeight: '100vh' }}>
      <h1 style={{ color: 'red' }}>React Test App Works!</h1>
      <p>If you can see this, React is working fine.</p>
      <button onClick={() => alert('Button works!')}>Test Button</button>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)