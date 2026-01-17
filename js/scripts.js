/*!
* Start Bootstrap - Agency v7.0.12 (https://startbootstrap.com/theme/agency)
* Copyright 2013-2023 Start Bootstrap
* Licensed under MIT (https://github.com/StartBootstrap/startbootstrap-agency/blob/master/LICENSE)
*/
//
// Scripts
// 

window.addEventListener('DOMContentLoaded', event => {

    // Navbar shrink function
    var navbarShrink = function () {
        const navbarCollapsible = document.body.querySelector('#mainNav');
        if (!navbarCollapsible) {
            return;
        }
        if (window.scrollY === 0) {
            navbarCollapsible.classList.remove('navbar-shrink')
        } else {
            navbarCollapsible.classList.add('navbar-shrink')
        }

    };

    // Shrink the navbar 
    navbarShrink();

    // Shrink the navbar when page is scrolled
    document.addEventListener('scroll', navbarShrink);

    //  Activate Bootstrap scrollspy on the main nav element
    const mainNav = document.body.querySelector('#mainNav');
    if (mainNav) {
        new bootstrap.ScrollSpy(document.body, {
            target: '#mainNav',
            // reduce negative bottom margin so bottom-most sections activate at page end
            rootMargin: '0px 0px -10%',
        });
    };

    // Collapse responsive navbar when toggler is visible
    const navbarToggler = document.body.querySelector('.navbar-toggler');
    const responsiveNavItems = [].slice.call(
        document.querySelectorAll('#navbarResponsive .nav-link')
    );
    responsiveNavItems.map(function (responsiveNavItem) {
        responsiveNavItem.addEventListener('click', () => {
            if (window.getComputedStyle(navbarToggler).display !== 'none') {
                navbarToggler.click();
            }
        });
    });

    // Contact form validation and submission
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        const nameInput = document.getElementById('name');
        const emailInput = document.getElementById('email');
        const messageInput = document.getElementById('message');
        const submitBtn = document.getElementById('submitButton');

        function validateForm() {
            const name = (nameInput.value || '').trim();
            const email = (emailInput.value || '').trim();
            const message = (messageInput.value || '').trim();
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            const isValid = name && email && emailPattern.test(email) && message;
            if (isValid) {
                submitBtn.classList.remove('disabled');
                submitBtn.removeAttribute('disabled');
            } else {
                submitBtn.classList.add('disabled');
                submitBtn.setAttribute('disabled', 'disabled');
            }
        }

        nameInput.addEventListener('input', validateForm);
        emailInput.addEventListener('input', validateForm);
        messageInput.addEventListener('input', validateForm);

        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            validateForm();
            if (submitBtn.classList.contains('disabled')) {
                return;
            }

            // Collect form data as URL-encoded
            const formData = new URLSearchParams();
            formData.append('name', nameInput.value.trim());
            formData.append('email', emailInput.value.trim());
            formData.append('message', messageInput.value.trim());
            formData.append('website', document.querySelector('input[name="website"]').value);

            // POST to Apps Script (no iframe needed)
            fetch(contactForm.action, {
                method: 'POST',
                mode: 'no-cors',
                body: formData
            })
            .then(function() {
                // Always show success (Apps Script returns 200 regardless)
                const successMsg = document.getElementById('submitSuccessMessage');
                const errorMsg = document.getElementById('submitErrorMessage');
                if (successMsg) successMsg.classList.remove('d-none');
                if (errorMsg) errorMsg.classList.add('d-none');
                contactForm.reset();
                validateForm();
            })
            .catch(function() {
                // Network error
                const errorMsg = document.getElementById('submitErrorMessage');
                if (errorMsg) errorMsg.classList.remove('d-none');
            });
        });
    }

});
