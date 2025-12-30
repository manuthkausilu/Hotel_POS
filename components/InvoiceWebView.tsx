import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';

interface InvoiceWebViewProps {
  invoiceUrl: string;
  onClose: () => void;
}

export default function InvoiceWebView({ invoiceUrl, onClose }: InvoiceWebViewProps) {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Inject JavaScript to handle printing
  const injectedJavaScript = `
    (function() {
      // Wait for page to fully load
      window.addEventListener('load', function() {
        // Small delay to ensure all resources are loaded
        setTimeout(function() {
          // Auto-trigger print on Android
          if (window.print) {
            try {
              window.print();
            } catch (e) {
              console.error('Print error:', e);
            }
          }
          
          // Send message back to React Native
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'PRINT_TRIGGERED'
          }));
        }, 500);
      });
      
      // Listen for print completion (if browser supports it)
      if (window.matchMedia) {
        window.matchMedia('print').addListener(function(mql) {
          if (!mql.matches) {
            // Print dialog closed
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'PRINT_COMPLETED'
            }));
          }
        });
      }
    })();
    true; // Required for injectedJavaScript
  `;

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      switch (data.type) {
        case 'PRINT_TRIGGERED':
          console.log('✅ Print triggered successfully');
          break;
        case 'PRINT_COMPLETED':
          console.log('✅ Print dialog closed');
          // Optionally auto-close modal after printing
          // setTimeout(onClose, 1000);
          break;
        default:
          console.log('WebView message:', data);
      }
    } catch (err) {
      console.error('Failed to parse WebView message:', err);
    }
  };

  const handleNavigationStateChange = (navState: any) => {
    setCanGoBack(navState.canGoBack);
  };

  const handlePrintManually = () => {
    // Trigger print manually if auto-print failed
    webViewRef.current?.injectJavaScript(`
      if (window.print) {
        try {
          window.print();
        } catch (e) {
          alert('Print not supported');
        }
      }
      true;
    `);
  };

  const handleShare = () => {
    // Optional: Share invoice URL
    Alert.alert(
      'Share Invoice',
      `Invoice URL: ${invoiceUrl}`,
      [
        { text: 'Copy', onPress: () => {
          // Implement clipboard copy if needed
          console.log('Copy URL:', invoiceUrl);
        }},
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: invoiceUrl }}
        style={styles.webview}
        onMessage={handleMessage}
        injectedJavaScript={injectedJavaScript}
        onNavigationStateChange={handleNavigationStateChange}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        // Android-specific props for better printing
        androidLayerType="hardware"
        mixedContentMode="compatibility"
      />

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Loading invoice...</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        {canGoBack && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => webViewRef.current?.goBack()}
            activeOpacity={0.85}
          >
            <Text style={styles.actionButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[styles.actionButton, styles.printButton]}
          onPress={handlePrintManually}
          activeOpacity={0.85}
        >
          <Text style={[styles.actionButtonText, styles.printButtonText]}>Print Again</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleShare}
          activeOpacity={0.85}
        >
          <Text style={styles.actionButtonText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  printButton: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  printButtonText: {
    color: '#FFFFFF',
  },
});
