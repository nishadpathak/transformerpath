// Netlify serverless function for form submissions
// Handles team enquiry, enterprise enquiry, sponsor forms

const handler = async (event) => {
  const { httpMethod, body, path } = event;

  if (httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const data = JSON.parse(body);

    // Route to appropriate handler based on form type
    if (path.includes('/teams')) {
      return handleTeamsEnquiry(data);
    } else if (path.includes('/sponsor')) {
      return handleSponsorEnquiry(data);
    } else if (path.includes('/list-company')) {
      return handleListCompanyEnquiry(data);
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid form type' }),
    };
  } catch (err) {
    console.error('Form submission error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to process form' }),
    };
  }
};

async function handleTeamsEnquiry(data) {
  const { name, company, email, teamSize, region, orgType, trainingGoals } = data;

  // Validation
  if (!email || !company || !name) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: name, company, email' }),
    };
  }

  // TODO: Save to database or send email notification
  console.log('Teams enquiry received:', {
    name,
    company,
    email,
    teamSize,
    region,
    orgType,
    trainingGoals,
    timestamp: new Date().toISOString(),
  });

  // TODO: Send confirmation email via SendGrid/Mailgun
  // TODO: Notify admin via email or Slack

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      message: 'Your enquiry has been received. We will contact you within 24 hours.',
    }),
  };
}

async function handleSponsorEnquiry(data) {
  const { name, company, email, budget, sponsorType } = data;

  if (!email || !company) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields' }),
    };
  }

  console.log('Sponsor enquiry received:', {
    name,
    company,
    email,
    budget,
    sponsorType,
    timestamp: new Date().toISOString(),
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      message: 'Thank you for your interest. Our team will be in touch soon.',
    }),
  };
}

async function handleListCompanyEnquiry(data) {
  const { companyName, website, category, email, primaryContact } = data;

  if (!companyName || !email) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields' }),
    };
  }

  console.log('List company enquiry received:', {
    companyName,
    website,
    category,
    email,
    primaryContact,
    timestamp: new Date().toISOString(),
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      message: 'Your company listing request has been received.',
    }),
  };
}

exports.handler = handler;
