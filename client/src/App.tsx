// App.tsx
import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [message, setMessage] = useState('Loading...');

  useEffect(() => {
    // 백엔드 API 호출
    fetch('http://localhost:8080/api/test')
      .then((response) => response.text())
      .then((data) => setMessage(data))
      .catch((error) => setMessage(`Error: ${error.message}`));
  }, []);

  return (
    <>
      <h1>Backend says:</h1>
      <p style={{ color: 'blue', fontSize: '24px' }}>{message}</p>
    </>
  );
}

export default App;