import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import PatientSelect from './pages/PatientSelect.jsx'
import Patient from './pages/Patient.jsx'
import AIChat from './pages/AIChat.jsx'
import EmojiGame from './pages/EmojiGame.jsx'
import ColorLineGame from './pages/ColorLineGame.jsx'
import ObjectNamingGame from './pages/ObjectNamingGame.jsx'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/patient" element={<PatientSelect />} />
        <Route path="/patient/games" element={<Patient />} />
        <Route path="/patient/ai-chat" element={<AIChat />} />
        <Route path="/emoji-game" element={<EmojiGame />} />
        <Route path="/color-game" element={<ColorLineGame />} />
        <Route path="/object-game" element={<ObjectNamingGame />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
