import { Component } from 'react'
import Icon from './Icon.jsx'

// Catches render errors so one broken page shows a message instead of a blank app.
// Pass a changing `resetKey` (e.g. the route path) so navigating away clears the error.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto max-w-[760px] px-4 md:px-8 py-16 text-center">
        <Icon name="triangle-alert" size={36} className="mx-auto mb-4 text-coral" />
        <h2 className="mb-2 text-[22px] font-bold">Something went wrong on this page</h2>
        <p className="mx-auto mb-5 max-w-sm text-[14.5px] text-ink-soft">
          The rest of the app is fine. Try going back to the marketplace.
        </p>
        <a href="/marketplace" className="btn-accent">Go to Marketplace</a>
      </div>
    )
  }
}
