import * as Print from 'expo-print';
import { Platform, Alert } from 'react-native';
import { BillData } from './billMapper';
import { generateThermalBillHTML } from './thermalBillTemplate';

export interface PrintOptions {
  printerUrl?: string;
  copies?: number;
}

/**
 * Print thermal bill using expo-print
 * Supports both Android and iOS
 */
export async function printThermalBill(billData: BillData, options?: PrintOptions): Promise<void> {
  try {
    const html = generateThermalBillHTML(billData);
    
    const printOptions: Print.PrintOptions = {
      html,
      width: 302,
    };

    if (Platform.OS === 'android') {
      await Print.printAsync(printOptions);
    } else if (Platform.OS === 'ios') {
      await Print.printAsync(printOptions);
    } else {
      const { uri } = await Print.printToFileAsync({ html });
      Alert.alert('Print', `Bill saved to: ${uri}`);
    }
  } catch (error: any) {
    console.error('Print error:', error);
    
    // Check if user cancelled the print dialog
    if (error?.message?.includes('cancelled') || 
        error?.message?.includes('canceled') ||
        error?.message?.includes('did not complete') ||
        error?.code === 'E_PRINT_CANCELLED') {
      console.log('Print cancelled by user');
      throw new Error('Print cancelled');
    }
    
    throw new Error(`Failed to print: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Generate PDF for sharing/preview
 */
export async function generateBillPDF(billData: BillData): Promise<string> {
  try {
    const html = generateThermalBillHTML(billData);
    const { uri } = await Print.printToFileAsync({ html });
    return uri;
  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error(`Failed to generate PDF: ${(error as Error).message}`);
  }
}
