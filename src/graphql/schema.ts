export const typeDefs = `#graphql
  type Offer {
    id: String!
    name: String!
    description: String
    offerType: String!
    startDate: String!
    endDate: String!
    isActive: Boolean!
    merchantId: String!
    outlets: [Outlet!]!
  }

  type Outlet {
    id: String!
    name: String!
    description: String
    isActive: Boolean!
  }

  type Query {
    # Get offers for a specific user at an outlet
    offers(userId: String!, outletId: String): [Offer!]!
    
    # Get user's loyalty points
    userLoyaltyPoints(userId: String!): UserLoyaltyPoints
  }

  type Mutation {
    # Create a cashback offer (triggers background eligibility computation)
    createCashbackOffer(input: CreateCashbackInput!): CashbackOffer!
    
    # Update user loyalty points
    updateLoyaltyPoints(userId: String!, points: Float!): UserLoyaltyPoints!
  }

  type CashbackOffer {
    id: String!
    name: String!
    eligibleCustomerTypes: [String!]!
    merchantId: String!
  }

  type UserLoyaltyPoints {
    id: String!
    points: Float!
    lastUpdated: String!
  }

  input CreateCashbackInput {
    id: String!
    name: String!
    merchantId: String!
    eligibleCustomerTypes: [String!]!
    startDate: String!
    endDate: String!
  }
`;