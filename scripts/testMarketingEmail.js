require("dotenv").config();
const mongoose = require("mongoose");
const { sendMarketingEmail } = require("../services/mailer");
const Patient = require("../models/Patient");

/**
 * Test script for sending marketing emails to all patients
 * Usage: node scripts/testMarketingEmail.js [locale]
 * Example: node scripts/testMarketingEmail.js de
 */

async function testMarketingEmail() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.DB_CONNECTION_STRING);
    console.log("✅ Connected to MongoDB");

    // Get locale from command line or default to German
    const locale = process.argv[2] || "de";
    console.log(`📧 Locale: ${locale}`);

    // Get all patients
    const patients = await Patient.find({});
    
    if (patients.length === 0) {
      console.log("❌ No patients found in database");
      process.exit(0);
    }

    console.log(`📋 Found ${patients.length} patients`);
    
    // Example email content in different languages
    const emailContent = {
      de: {
        subject: "Wichtige Ankündigung – Praxis Dr. Kerim",
        content: `
          <p style="margin: 0 0 15px 0; line-height: 1.6;">
            wir möchten Sie über eine wichtige Neuerung in unserer Praxis informieren:
          </p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0066cc;">
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #0066cc;">
              📅 Neue Öffnungszeiten ab sofort:
            </p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Montag - Freitag: 08:00 - 18:00 Uhr</li>
              <li>Samstag: 09:00 - 13:00 Uhr</li>
            </ul>
          </div>
          
          <p style="margin: 15px 0; line-height: 1.6;">
            Zusätzlich freuen wir uns, Ihnen mitteilen zu können, dass wir ab sofort auch 
            <strong>Online-Terminbuchungen</strong> anbieten. Besuchen Sie unsere Website 
            <a href="https://praxiskerim.de" style="color: #0066cc; text-decoration: none;">praxiskerim.de</a> 
            um Ihren nächsten Termin bequem von zu Hause aus zu buchen.
          </p>
          
          <p style="margin: 15px 0; line-height: 1.6;">
            Bei Fragen stehen wir Ihnen gerne zur Verfügung:
          </p>
          
          <p style="margin: 10px 0; line-height: 1.6;">
            📞 Telefon: ${process.env.PRACTICE_PHONE || "+49 69 123456"}<br/>
            📧 E-Mail: ${process.env.PRACTICE_EMAIL || "info@praxiskerim.de"}<br/>
            💬 WhatsApp: ${process.env.PRACTICE_WHATSAPP || "+49 69 123456"}
          </p>
          
          <p style="margin: 20px 0 0 0; line-height: 1.6;">
            Wir freuen uns auf Ihren nächsten Besuch!
          </p>
        `,
      },
      en: {
        subject: "Important Announcement – Praxis Dr. Kerim",
        content: `
          <p style="margin: 0 0 15px 0; line-height: 1.6;">
            we would like to inform you about an important update at our practice:
          </p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0066cc;">
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #0066cc;">
              📅 New Opening Hours Effective Immediately:
            </p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Monday - Friday: 08:00 AM - 06:00 PM</li>
              <li>Saturday: 09:00 AM - 01:00 PM</li>
            </ul>
          </div>
          
          <p style="margin: 15px 0; line-height: 1.6;">
            Additionally, we are pleased to announce that we now offer 
            <strong>online appointment booking</strong>. Visit our website 
            <a href="https://praxiskerim.de" style="color: #0066cc; text-decoration: none;">praxiskerim.de</a> 
            to conveniently book your next appointment from home.
          </p>
          
          <p style="margin: 15px 0; line-height: 1.6;">
            If you have any questions, please feel free to contact us:
          </p>
          
          <p style="margin: 10px 0; line-height: 1.6;">
            📞 Phone: ${process.env.PRACTICE_PHONE || "+49 69 123456"}<br/>
            📧 Email: ${process.env.PRACTICE_EMAIL || "info@praxiskerim.de"}<br/>
            💬 WhatsApp: ${process.env.PRACTICE_WHATSAPP || "+49 69 123456"}
          </p>
          
          <p style="margin: 20px 0 0 0; line-height: 1.6;">
            We look forward to your next visit!
          </p>
        `,
      },
      bg: {
        subject: "Важно съобщение – Praxis Dr. Kerim",
        content: `
          <p style="margin: 0 0 15px 0; line-height: 1.6;">
            искаме да Ви информираме за важна новина в нашата практика:
          </p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0066cc;">
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #0066cc;">
              📅 Ново работно време от сега:
            </p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Понеделник - Петък: 08:00 - 18:00</li>
              <li>Събота: 09:00 - 13:00</li>
            </ul>
          </div>
          
          <p style="margin: 15px 0; line-height: 1.6;">
            Освен това се радваме да Ви съобщим, че вече предлагаме 
            <strong>онлайн записване на часове</strong>. Посетете нашия сайт 
            <a href="https://praxiskerim.de" style="color: #0066cc; text-decoration: none;">praxiskerim.de</a> 
            за удобно записване на следващия Ви час от дома.
          </p>
          
          <p style="margin: 15px 0; line-height: 1.6;">
            При въпроси сме на Ваше разположение:
          </p>
          
          <p style="margin: 10px 0; line-height: 1.6;">
            📞 Телефон: ${process.env.PRACTICE_PHONE || "+49 69 123456"}<br/>
            📧 Имейл: ${process.env.PRACTICE_EMAIL || "info@praxiskerim.de"}<br/>
            💬 WhatsApp: ${process.env.PRACTICE_WHATSAPP || "+49 69 123456"}
          </p>
          
          <p style="margin: 20px 0 0 0; line-height: 1.6;">
            Очакваме с нетърпение следващото Ви посещение!
          </p>
        `,
      },
    };

    // Get content for selected locale or default to German
    const content = emailContent[locale] || emailContent.de;

    console.log("\n📧 Email Preview:");
    console.log("─────────────────────────────────────────");
    console.log(`Subject: ${content.subject}`);
    console.log("─────────────────────────────────────────\n");

    // Confirm before sending
    console.log(`\n⚠️  About to send ${patients.length} emails!`);
    console.log("Press Ctrl+C within 5 seconds to cancel...\n");
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log("🚀 Starting email campaign...\n");

    // Send emails with progress tracking
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < patients.length; i++) {
      const patient = patients[i];
      
      try {
        await sendMarketingEmail(
          patient.email,
          patient.name,
          content.subject,
          content.content,
          locale
        );
        successCount++;
        console.log(`✅ [${i + 1}/${patients.length}] Sent to: ${patient.email}`);
      } catch (error) {
        failureCount++;
        console.error(`❌ [${i + 1}/${patients.length}] Failed to send to ${patient.email}:`, error.message);
      }

      // Small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log("\n============================================================");
    console.log("📊 Email Campaign Summary:");
    console.log("============================================================");
    console.log(`✅ Successfully sent: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}`);
    console.log(`📧 Total: ${patients.length}`);
    console.log("============================================================\n");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
    console.log("👋 Disconnected from MongoDB");
    process.exit(0);
  }
}

// Run the test
testMarketingEmail();

