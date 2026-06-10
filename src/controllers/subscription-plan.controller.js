const {
  listActiveSubscriptionPlans
} = require("../models/subscription-plan.model");

async function getSubscriptionPlans(_req, res, next) {
  try {
    const plans = await listActiveSubscriptionPlans();

    return res.status(200).json({
      status: "success",
      data: {
        plans
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSubscriptionPlans
};
