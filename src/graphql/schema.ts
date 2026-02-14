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

  type MerchantOffer {
    id: String!
    name: String!
    startDate: String
    endDate: String
    isActive: Boolean!
    merchantId: String!
    eligibleCustomerTypes: [String!]!
    outlets: [Outlet!]!
    netCashbackBudget: Float!
    usedCashbackBudget: Float!
  }

  type Query {
    offers(userId: String!, outletId: String): [Offer!]!
    userLoyaltyPoints(userId: String!): UserLoyaltyPoints
    
    offersByMerchant(merchantId: String!): [MerchantOffer!]!
  }

  type Mutation {
    createOffer(input: CreateOfferInput!): Offer!
    updateLoyaltyPoints(userId: String!, points: Float!): UserLoyaltyPoints!
  }


  type UserLoyaltyPoints {
    id: String!
    points: Float!
    lastUpdated: String!
  }



  input CreateOfferInput {
    name: String!
    offerType: OfferType!
    merchantId: String!
    eligibleCustomerTypes: [String!]!
    startDate: String!
    endDate: String!
    outletIds: [String!]!
    netCashbackBudget: Float
    description: String
  }

  enum OfferType {
    CASHBACK
    EXCLUSIVE
    LOYALTY
  }
`;