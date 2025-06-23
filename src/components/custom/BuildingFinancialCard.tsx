
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Building, DollarSign, TrendingUp, AlertCircle, Clock, CheckCircle } from "lucide-react";

interface BuildingFinancialCardProps {
  buildingName: string;
  currentMonthExpenses: number;
  currentMonthIncomeCollected: number;
  currentMonthIncomePendingConfirmation: number;
  currentMonthIncomeToBeCollected: number;
  periodDescription: string;
}

export function BuildingFinancialCard({
  buildingName,
  currentMonthExpenses,
  currentMonthIncomeCollected,
  currentMonthIncomePendingConfirmation,
  currentMonthIncomeToBeCollected,
  periodDescription,
}: BuildingFinancialCardProps) {
  const netCurrentMonth = currentMonthIncomeCollected - currentMonthExpenses;

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 mb-1">
          <Building className="h-6 w-6 text-primary" />
          <CardTitle className="font-headline text-xl text-foreground">{buildingName}</CardTitle>
        </div>
        <CardDescription>Financial Summary for {periodDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm flex-grow">
        <div className="flex items-center justify-between p-2 bg-destructive/10 rounded-md">
          <div className="flex items-center">
            <DollarSign className="h-4 w-4 text-destructive mr-2" />
            <span className="font-medium text-destructive">Expenses (Utilities):</span>
          </div>
          <span className="font-semibold text-destructive">{currentMonthExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</span>
        </div>

        <div className="space-y-1.5 pt-2">
           <p className="text-xs text-muted-foreground font-semibold">Income Breakdown:</p>
            <div className="flex items-center justify-between p-1.5 bg-green-500/10 rounded-md">
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                <span className="text-green-700">Collected:</span>
              </div>
              <span className="font-medium text-green-700">{currentMonthIncomeCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</span>
            </div>
            <div className="flex items-center justify-between p-1.5 bg-blue-500/10 rounded-md">
              <div className="flex items-center">
                 <Clock className="h-4 w-4 text-blue-600 mr-2" />
                <span className="text-blue-700">Pending Confirmation:</span>
              </div>
              <span className="font-medium text-blue-700">{currentMonthIncomePendingConfirmation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</span>
            </div>
             <div className="flex items-center justify-between p-1.5 bg-yellow-500/10 rounded-md">
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 text-yellow-700 mr-2" />
                <span className="text-yellow-800">To Be Collected:</span>
              </div>
              <span className="font-medium text-yellow-800">{currentMonthIncomeToBeCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr</span>
            </div>
        </div>
        
      </CardContent>
      <CardFooter className="border-t mt-auto pt-3">
        <div className="flex items-center justify-between w-full">
            <div className="flex items-center">
                <TrendingUp className={`h-5 w-5 mr-2 ${netCurrentMonth >= 0 ? 'text-green-500' : 'text-destructive'}`} />
                <span className="text-sm font-semibold text-muted-foreground">Net (Collected - Expenses):</span>
            </div>
            <span className={`text-lg font-bold ${netCurrentMonth >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {netCurrentMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr
            </span>
        </div>
      </CardFooter>
    </Card>
  );
}
