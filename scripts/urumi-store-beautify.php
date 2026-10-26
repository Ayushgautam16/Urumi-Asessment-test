<?php
/**
 * Plugin Name: Urumi Modern Store UI Enhancements
 * Description: Clean, responsive, human-designed store styling with modern typography and sleek horizontal product cards.
 * Version: 4.0.0
 */

// Force clear any emoji in blogname
add_filter('pre_option_blogname', function($name) {
    return 'Urumi Store';
});

add_action('wp_head', function() {
    ?>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style id="urumi-fixed-store-styles">
        :root {
            --font-main: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            --color-bg: #f8fafc;
            --color-surface: #ffffff;
            --color-text: #0f172a;
            --color-muted: #64748b;
            --color-border: #e2e8f0;
            --color-price: #059669;
        }

        body {
            font-family: var(--font-main) !important;
            background-color: var(--color-bg) !important;
            color: var(--color-text) !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-font-smoothing: antialiased;
        }

        /* Top Minimal Utility Bar */
        .urumi-clean-bar {
            background: #ffffff;
            color: var(--color-muted);
            font-size: 0.82rem;
            padding: 10px 24px;
            text-align: center;
            font-weight: 500;
            border-bottom: 1px solid var(--color-border);
            letter-spacing: 0.01em;
        }

        /* Clean Header */
        header.wp-block-template-part {
            background: #ffffff !important;
            border-bottom: 1px solid var(--color-border) !important;
            padding: 16px 36px !important;
            position: sticky !important;
            top: 0 !important;
            z-index: 100 !important;
        }

        header .wp-block-site-title a {
            font-weight: 700 !important;
            font-size: 1.25rem !important;
            color: var(--color-text) !important;
            text-decoration: none !important;
        }

        .wp-block-navigation a {
            font-weight: 600 !important;
            color: #475569 !important;
            font-size: 0.92rem !important;
            text-decoration: none !important;
            transition: color 0.15s ease !important;
        }
        .wp-block-navigation a:hover {
            color: #0f172a !important;
        }

        /* Store Catalog Section */
        .urumi-catalog-wrap {
            max-width: 1200px;
            margin: 32px auto 0 auto;
            padding: 0 24px;
        }

        .urumi-catalog-title {
            font-size: 1.85rem;
            font-weight: 700;
            letter-spacing: -0.02em;
            color: #0f172a;
            margin: 0 0 6px 0;
        }

        .urumi-catalog-sub {
            font-size: 0.95rem;
            color: #64748b;
            margin: 0;
        }

        /* Content Container */
        .wp-site-blocks, main, .woocommerce {
            max-width: 1200px !important;
            margin: 0 auto !important;
            padding: 0 24px !important;
        }

        /* Horizontal Row Grid for Products */
        .wp-block-woocommerce-product-collection,
        .wc-block-product-template,
        .wc-block-product-template__responsive,
        ul.products,
        .wp-block-woocommerce-product-template {
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: wrap !important;
            align-items: stretch !important;
            justify-content: flex-start !important;
            gap: 28px !important;
            width: 100% !important;
            max-width: 1200px !important;
            margin: 28px auto 80px auto !important;
            padding: 0 !important;
            list-style: none !important;
            box-sizing: border-box !important;
        }

        /* Individual Card Width - Horizontal Side by Side */
        .wc-block-product-template__responsive li,
        .wc-block-product-template li,
        .wc-block-product,
        ul.products li.product {
            flex: 0 0 340px !important;
            width: 340px !important;
            max-width: 340px !important;
            min-width: 300px !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            border-radius: 16px !important;
            border: 1px solid var(--color-border) !important;
            padding: 20px !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04) !important;
            transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease !important;
        }

        .wc-block-product:hover,
        ul.products li.product:hover {
            transform: translateY(-4px) !important;
            border-color: #cbd5e1 !important;
            box-shadow: 0 12px 24px -4px rgba(15, 23, 42, 0.08) !important;
        }

        /* Product Image Framing */
        .wc-block-components-product-image,
        .wc-block-components-product-image img,
        ul.products li.product img {
            width: 100% !important;
            height: 220px !important;
            max-height: 220px !important;
            object-fit: cover !important;
            border-radius: 10px !important;
            margin: 0 0 16px 0 !important;
            background: #f1f5f9 !important;
            display: block !important;
        }

        /* Product Title */
        .wc-block-components-product-name,
        .wc-block-components-product-name a,
        ul.products li.product .woocommerce-loop-product__title {
            font-size: 1.05rem !important;
            font-weight: 700 !important;
            color: #0f172a !important;
            margin: 0 0 8px 0 !important;
            line-height: 1.4 !important;
            text-decoration: none !important;
            display: -webkit-box !important;
            -webkit-line-clamp: 2 !important;
            -webkit-box-orient: vertical !important;
            overflow: hidden !important;
            height: 2.8em !important;
            white-space: normal !important;
        }

        /* Price */
        .wc-block-components-product-price,
        .price {
            font-size: 1.2rem !important;
            font-weight: 800 !important;
            color: var(--color-price) !important;
            margin: 0 0 16px 0 !important;
            text-align: left !important;
            display: block !important;
        }

        /* Add to Cart Button */
        .wp-block-button.wc-block-components-product-button,
        .wc-block-components-product-button {
            width: 100% !important;
            margin-top: auto !important;
            padding: 0 !important;
        }

        .wc-block-components-product-button__button,
        .button.add_to_cart_button,
        .wp-block-button__link {
            width: 100% !important;
            display: block !important;
            background: #0f172a !important;
            color: #ffffff !important;
            font-size: 0.9rem !important;
            font-weight: 600 !important;
            text-align: center !important;
            padding: 12px 18px !important;
            border-radius: 8px !important;
            text-decoration: none !important;
            border: none !important;
            cursor: pointer !important;
            box-sizing: border-box !important;
            white-space: nowrap !important;
            box-shadow: 0 2px 6px rgba(15, 23, 42, 0.12) !important;
            transition: all 0.15s ease !important;
        }

        .wc-block-components-product-button__button:hover,
        .button.add_to_cart_button:hover {
            background: #1e293b !important;
            color: #ffffff !important;
            transform: translateY(-1px) !important;
        }

        /* Hide unwanted theme elements */
        .wp-block-woocommerce-coming-soon,
        .woocommerce-products-header__title {
            display: none !important;
        }
    </style>
    <?php
});

// Top bar and section title
add_action('wp_body_open', function() {
    ?>
    <div class="urumi-clean-bar">
        Free domestic shipping &bull; Cash on Delivery available at checkout
    </div>
    <?php
    if (is_shop() || is_front_page()) {
        ?>
        <div class="urumi-catalog-wrap">
            <h1 class="urumi-catalog-title">Hardware & Peripherals</h1>
            <p class="urumi-catalog-sub">Precision mechanical keyboards, ergonomic mice, and studio audio gear.</p>
        </div>
        <?php
    }
});
