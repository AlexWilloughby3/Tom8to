import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { accountService, authService, dataService } from "../api/services";
import type { UserDataImport } from "../types";
import "./Settings.css";

export default function Settings() {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved === "true";
  });

  const [soundNotifications, setSoundNotifications] = useState(() => {
    const saved = localStorage.getItem("soundNotifications");
    return saved === "true";
  });

  const [browserNotifications, setBrowserNotifications] = useState(() => {
    const saved = localStorage.getItem("browserNotifications");
    return saved === "true";
  });

  const [showOnLeaderboard, setShowOnLeaderboard] = useState(() => {
    return user?.show_on_leaderboard ?? true;
  });

  const [displayName, setDisplayName] = useState(() => {
    return user?.display_name || user?.email || "";
  });
  const [isEditingDisplayName, setIsEditingDisplayName] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
    localStorage.setItem("darkMode", darkMode.toString());
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem("soundNotifications", soundNotifications.toString());
  }, [soundNotifications]);

  useEffect(() => {
    localStorage.setItem(
      "browserNotifications",
      browserNotifications.toString(),
    );
  }, [browserNotifications]);

  useEffect(() => {
    // Sync showOnLeaderboard and displayName with user state when user changes
    if (user) {
      setShowOnLeaderboard(user.show_on_leaderboard);
      setDisplayName(user.display_name || user.email);
    }
  }, [user]);

  const handleToggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const handleToggleSoundNotifications = () => {
    setSoundNotifications(!soundNotifications);
  };

  const handleToggleBrowserNotifications = async () => {
    if (!browserNotifications) {
      // Request permission when enabling
      if ("Notification" in window) {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          setBrowserNotifications(true);
        } else {
          setError("Browser notification permission denied");
        }
      } else {
        setError("Browser notifications not supported");
      }
    } else {
      setBrowserNotifications(false);
    }
  };

  const handleToggleLeaderboard = async () => {
    if (!user) return;

    try {
      const newValue = !showOnLeaderboard;
      const updatedUser = await authService.updateUser(user.email, {
        show_on_leaderboard: newValue,
      });
      setShowOnLeaderboard(newValue);
      updateUser(updatedUser); // Update AuthContext and localStorage
      setMessage(
        newValue
          ? "You will now appear on the leaderboard"
          : "You have been removed from the leaderboard",
      );
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setError(err?.message || "Failed to update leaderboard setting");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleSaveDisplayName = async () => {
    if (!user) return;
    if (!displayName.trim()) {
      setError("Display name cannot be empty");
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      const updatedUser = await authService.updateUser(user.email, {
        display_name: displayName.trim(),
      });
      updateUser(updatedUser);
      setIsEditingDisplayName(false);
      setMessage("Display name updated successfully");
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setError(err?.message || "Failed to update display name");
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleCancelEditDisplayName = () => {
    setDisplayName(user?.display_name || user?.email || "");
    setIsEditingDisplayName(false);
  };

  const handleRequestPasswordReset = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);
    if (!user) return;
    try {
      const res = await accountService.requestPasswordReset(user.email);
      setMessage(res.message || "Password reset email sent! Check your inbox.");
    } catch (err: any) {
      setError(err?.message || "Failed to send password reset email");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (!confirm("Are you sure you want to permanently delete your account?"))
      return;
    try {
      await authService.deleteUser(user.email);
      logout();
      navigate("/register");
    } catch (err: any) {
      setError(err?.message || "Failed to delete account");
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const exportData = await dataService.exportData(user.email);

      // Create a blob and download it
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `focus-tracker-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage("Data exported successfully!");
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setError(err?.message || "Failed to export data");
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleImportData = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (!user) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const text = await file.text();
      const importData: UserDataImport = JSON.parse(text);

      // Validate the structure
      if (
        !importData.version ||
        !importData.categories ||
        !importData.goals ||
        !importData.sessions
      ) {
        throw new Error("Invalid import file format");
      }

      // Confirm import
      if (
        !confirm(
          `This will import ${importData.categories.length} categories, ${importData.goals.length} goals, ` +
            `and ${importData.sessions.length} sessions. Existing data will be updated where conflicts occur. Continue?`,
        )
      ) {
        return;
      }

      const result = await dataService.importData(user.email, importData);
      setMessage(result.message);
      setTimeout(() => setMessage(null), 5000);
    } catch (err: any) {
      setError(err?.message || "Failed to import data");
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      <section className="settings-section">
        <h2>Profile</h2>
        <div className="settings-option">
          <div className="settings-option-info">
            <h3>Display Name</h3>
            <p>Your display name will appear on the leaderboard</p>
          </div>
          {isEditingDisplayName ? (
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={255}
                style={{
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  flex: 1,
                }}
              />
              <button
                onClick={handleSaveDisplayName}
                className="btn btn-primary"
                style={{ padding: "8px 16px" }}
              >
                Save
              </button>
              <button
                onClick={handleCancelEditDisplayName}
                className="btn btn-secondary"
                style={{ padding: "8px 16px" }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span style={{ fontWeight: "bold" }}>{displayName}</span>
              <button
                onClick={() => setIsEditingDisplayName(true)}
                className="btn btn-primary"
                style={{ padding: "8px 16px" }}
              >
                Edit
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="settings-section">
        <h2>Appearance</h2>
        <div className="settings-option">
          <div className="settings-option-info">
            <h3>Dark Mode</h3>
            <p>Toggle dark mode for a comfortable viewing experience</p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={darkMode}
              onChange={handleToggleDarkMode}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h2>Notifications</h2>
        <div className="settings-option">
          <div className="settings-option-info">
            <h3>Sound Notifications</h3>
            <p>
              Play a sound when pomodoro timer transitions between work and
              break
            </p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={soundNotifications}
              onChange={handleToggleSoundNotifications}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="settings-option">
          <div className="settings-option-info">
            <h3>Browser Notifications</h3>
            <p>
              Show desktop notifications when pomodoro timer completes or
              transitions
            </p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={browserNotifications}
              onChange={handleToggleBrowserNotifications}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h2>Privacy</h2>
        <div className="settings-option">
          <div className="settings-option-info">
            <h3>Show on Leaderboard</h3>
            <p>
              Display your stats on the public leaderboard for all users to see
            </p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={showOnLeaderboard}
              onChange={handleToggleLeaderboard}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h2>Reset Password</h2>
        <p>We'll send you an email with a link to reset your password.</p>
        <button
          onClick={handleRequestPasswordReset}
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? "Sending..." : "Send Password Reset Email"}
        </button>
      </section>

      <section className="settings-section">
        <h2>Data Management</h2>
        <p>
          Export your data as a backup or import data from a previous export.
        </p>
        <div className="data-management-buttons">
          <button
            onClick={handleExportData}
            className="btn btn-primary"
            disabled={loading}
          >
            Export Data
          </button>
          <label
            htmlFor="import-file"
            className="btn btn-primary"
            style={{
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            Import Data
          </label>
          <input
            ref={fileInputRef}
            id="import-file"
            type="file"
            accept=".json"
            onChange={handleImportData}
            disabled={loading}
            style={{ display: "none" }}
          />
        </div>
        <p className="settings-note">
          Note: Exported data is account-agnostic and can be imported into any
          account. When importing, existing data will be updated where conflicts
          occur.
        </p>
      </section>

      <section className="settings-section">
        <h2>Account</h2>
        <p>Delete your account permanently. This will remove all your data.</p>
        <button onClick={handleDeleteAccount} className="btn btn-primary">
          Delete Account
        </button>
      </section>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}
    </div>
  );
}
