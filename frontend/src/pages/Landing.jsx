import { Link } from 'react-router-dom'
import './Landing.css'

function Landing() {
  return (
    <div className="landing">
      <div className="landing-content">
        <h1 className="title">NextShot AI</h1>
        <p className="subtitle">
          Elevate your training with intelligent analytics and actionable insights.
        </p>
        <Link to="/signup" className="signup-button">Sign Up</Link>
        <p className="login-link">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  )
}

export default Landing
