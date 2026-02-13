/**
 * Ecwid Payment Gateway Bridge
 * 
 * Instructions:
 * 1. Log in to your Ecwid Control Panel.
 * 2. Go to "Settings" -> "Tracking & Analytics" -> "Custom Tracking Code".
 * 3. Paste this ENTIRE script into the code area.
 * 4. Replace 'https://YOUR_APP_URL.com' with your actual deployed middleware URL.
 */

Ecwid.OnPageLoaded.add(function (page) {
    // Only run on the "Thank You" / Order Confirmation page
    if (page.type === "ORDER_CONFIRMATION") {
        var orderId = page.orderId;
        console.log("Order Placed: " + orderId);

        // Your Middleware URL (UPDATE THIS AFTER DEPLOYMENT)
        var API_BASE_URL = 'https://YOUR_APP_URL.com';

        // 1. Fetch the payment method name from our backend
        // We use our backend because getting payment method name from simple 'page' object 
        // is not always reliable or available in all Ecwid plans without OAuth.
        fetch(API_BASE_URL + '/api/orders/' + orderId + '/payment-method')
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                if (data && data.success && data.data.paymentMethod) {
                    var method = data.data.paymentMethod.toLowerCase();
                    console.log("Payment Method: " + method);

                    // 2. Redirect based on Payment Method
                    // Matches names you set in Ecwid Control Panel (case-insensitive)
                    if (method.indexOf('payone') !== -1) {
                        window.location.href = API_BASE_URL + '/checkout/payone/' + orderId;
                    } else if (method.indexOf('noon') !== -1) {
                        window.location.href = API_BASE_URL + '/checkout/noon/' + orderId;
                    } else if (method.indexOf('moyasar') !== -1 || method.indexOf('moysser') !== -1) {
                        window.location.href = API_BASE_URL + '/checkout/moyasar/' + orderId;
                    } else {
                        console.log("Unknown or offline payment method: " + method);
                        // Do nothing, let the user see "Thank you" page (e.g. for Cash on Delivery)
                    }
                }
            })
            .catch(function (error) {
                console.error("Error fetching payment method:", error);
            });
    }
});
