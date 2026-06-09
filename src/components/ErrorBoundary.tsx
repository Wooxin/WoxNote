import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: "grid",
          placeItems: "center",
          width: "100vw",
          height: "100vh",
          background: "#171a1f",
          color: "#d7dce2",
          fontFamily: "HarmonyOS Sans, Inter, system-ui, sans-serif",
          padding: 24,
        }}>
          <div style={{ maxWidth: 520, textAlign: "center" }}>
            <h2 style={{ color: "#ffb4ab", margin: "0 0 12px" }}>WoxNote Error</h2>
            <p style={{ color: "#b6c0ca", margin: "0 0 16px", lineHeight: 1.6 }}>
              Something went wrong. Please restart the app.
            </p>
            <pre style={{
              background: "#1d2127",
              border: "1px solid #343d48",
              borderRadius: 8,
              padding: 14,
              color: "#dce2e8",
              fontSize: 12,
              overflow: "auto",
              textAlign: "left",
              maxHeight: 240,
              whiteSpace: "pre-wrap",
            }}>
              {this.state.error.message}{"\n\n"}{this.state.error.stack}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
