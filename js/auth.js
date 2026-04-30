// Login / sign-up screen + session management.
// Renders an overlay over the app shell when there is no logged-in user.

const Auth = (() => {
  let mode = 'signin'; // 'signin' | 'signup'

  function showOverlay() {
    document.body.classList.add('auth-locked');
    let root = document.getElementById('auth-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'auth-root';
      document.body.appendChild(root);
    }
    render(root);
  }

  function hideOverlay() {
    document.body.classList.remove('auth-locked');
    const root = document.getElementById('auth-root');
    if (root) root.remove();
  }

  function render(root) {
    const isSignup = mode === 'signup';
    root.innerHTML = `
      <div class="auth-card">
        <div class="auth-brand">
          <div class="brand-mark">CU</div>
          <div>
            <div class="auth-title">Carpet &amp; Upholstery CRM</div>
            <div class="auth-sub">Sign ${isSignup ? 'up to create your workspace' : 'in to your workspace'}</div>
          </div>
        </div>
        <form id="auth-form">
          <div class="field">
            <label class="label">Email</label>
            <input class="input" type="email" name="email" required autocomplete="email" autofocus />
          </div>
          <div class="field">
            <label class="label">Password</label>
            <input class="input" type="password" name="password" required minlength="6" autocomplete="${isSignup ? 'new-password' : 'current-password'}" />
            ${isSignup ? '<p class="text-muted" style="font-size:11px;margin-top:6px;">At least 6 characters.</p>' : ''}
          </div>
          <div id="auth-error" class="auth-error" style="display:none;"></div>
          <button type="submit" class="btn w-full" style="padding:12px;margin-top:8px;">
            ${isSignup ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <div class="auth-toggle">
          ${isSignup
            ? `Already have an account? <a href="#" id="toggle-mode">Sign in</a>`
            : `New here? <a href="#" id="toggle-mode">Create an account</a>`
          }
        </div>
        <div class="auth-foot">
          Each workspace is fully isolated — your data is yours.
        </div>
      </div>
    `;

    document.getElementById('toggle-mode').addEventListener('click', (e) => {
      e.preventDefault();
      mode = mode === 'signin' ? 'signup' : 'signin';
      render(root);
    });

    document.getElementById('auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const email = fd.get('email').trim();
      const password = fd.get('password');
      const errEl = document.getElementById('auth-error');
      const btn = e.target.querySelector('button[type="submit"]');
      errEl.style.display = 'none';
      btn.disabled = true;
      btn.textContent = isSignup ? 'Creating account…' : 'Signing in…';
      try {
        if (isSignup) {
          await Supa.signUp(email, password);
          // Supabase by default sends a confirmation email. If confirmation is
          // disabled in the project, the session is established immediately.
          // Try to sign in to detect the case where confirmation is required.
          try {
            await Supa.signIn(email, password);
          } catch {
            errEl.textContent = 'Account created — please check your email to confirm, then sign in.';
            errEl.style.display = 'block';
            mode = 'signin';
            btn.disabled = false;
            render(root);
            return;
          }
        } else {
          await Supa.signIn(email, password);
        }
        // onAuthStateChange handler in app.js will hide the overlay and load the app.
      } catch (err) {
        errEl.textContent = err.message || 'Sign in failed';
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = isSignup ? 'Create account' : 'Sign in';
      }
    });
  }

  return { showOverlay, hideOverlay };
})();
