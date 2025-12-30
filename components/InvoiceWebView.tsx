import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, Platform, SafeAreaView } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface InvoiceWebViewProps {
  invoiceUrl: string;
  onClose: () => void;
}

export default function InvoiceWebView({ invoiceUrl, onClose }: InvoiceWebViewProps) {
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authHeaders, setAuthHeaders] = useState<Record<string, string>>({});

  // Load auth token and prepare headers
  React.useEffect(() => {
    const loadAuthHeaders = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          setAuthHeaders({
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'text/html',
          });
        }
      } catch (err) {
        console.error('Failed to load auth token:', err);
      }
    };
    loadAuthHeaders();
  }, []);

  // Inject JavaScript to handle printing and responsive viewport
  const injectedJavaScript = `
    (function() {
      // Force responsive viewport meta tag
      var meta = document.querySelector('meta[name="viewport"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'viewport';
        document.head.appendChild(meta);
      }
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      
      // Add responsive and centering styles
      var style = document.createElement('style');
      style.textContent = \`
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          background-color: #ffffff;
        }
        body {
          padding: 10px;
          overflow-x: hidden;
          max-width: 100vw;
          box-sizing: border-box;
        }
        body > * {
          max-width: 100%;
          margin-left: auto;
          margin-right: auto;
          box-sizing: border-box;
        }
        /* Center main content wrapper */
        body > div,
        body > main,
        body > section,
        body > article {
          width: 100%;
          max-width: 800px;
          margin-left: auto !important;
          margin-right: auto !important;
        }
        * {
          max-width: 100%;
          box-sizing: border-box;
        }
        img {
          height: auto !important;
          max-width: 100% !important;
        }
        table {
          width: 100% !important;
          table-layout: fixed;
          margin-left: auto;
          margin-right: auto;
        }
        /* Print styles */
        @media print {
          html, body {
            background-color: white;
            padding: 0;
          }
        }
      \`;
      document.head.appendChild(style);
      
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
          break;
        default:
          console.log('WebView message:', data);
      }
    } catch (err) {
      console.error('Failed to parse WebView message:', err);
    }
  };

  const handlePrintManually = () => {
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
    Alert.alert(
      'Share Invoice',
      `Invoice URL: ${invoiceUrl}`,
      [
        { text: 'Copy', onPress: () => {
          console.log('Copy URL:', invoiceUrl);
        }},
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{ 
            uri: invoiceUrl,
            headers: authHeaders,
          }}
          style={styles.webview}
          onMessage={handleMessage}
          injectedJavaScript={injectedJavaScript}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          androidLayerType="hardware"
          mixedContentMode="compatibility"
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          setSupportMultipleWindows={false}
          showsVerticalScrollIndicator={true}
          showsHorizontalScrollIndicator={false}
          contentMode="mobile"
        />

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.loadingText}>Loading invoice...</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.actionButton, styles.printButton]}
            onPress={handlePrintManually}
            activeOpacity={0.85}
          >
            <Text style={[styles.actionButtonText, styles.printButtonText]} numberOfLines={1}>
              Print
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.closeButton]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={[styles.actionButtonText, styles.closeButtonText]} numberOfLines={1}>
              Close
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FF6B6B',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  webview: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: 12,
    minHeight: 60,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  printButton: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  printButtonText: {
    color: '#FFFFFF',
  },
  closeButton: {
    backgroundColor: '#374151',
    borderColor: '#374151',
  },
  closeButtonText: {
    color: '#FFFFFF',
  },
});
