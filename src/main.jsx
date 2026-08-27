import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { CrmProvider } from './context/CrmContext'
import GlobalLoader from './components/GlobalLoader'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <CrmProvider>
        <App />
        <GlobalLoader />
      </CrmProvider>
    </BrowserRouter>
  </React.StrictMode>
)
